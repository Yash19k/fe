/**
 * Sanitized rendering for captured and CMS-provided markup.
 *
 * Three kinds of content arrive as markup strings, and they are not the
 * same problem:
 *
 *   RichText    a Framer formatted-text field, read from the CMS when the
 *               page renders - so not fixed at export time. Prose allowlist.
 *   SvgGraphic  an icon captured off the published page. DOMPurify's SVG
 *               profile, so shapes and gradients survive and scripts and
 *               event handlers do not.
 *   Snapshot    a sealed section captured verbatim for pixel fidelity.
 *               The widest profile - layout styles must survive - but
 *               still no script, no iframes, no handlers.
 *
 * None of them injects HTML: DOMPurify returns a DocumentFragment and the
 * walker below builds React elements from it with createElement.
 */
import React from "react"
import DOMPurify from "isomorphic-dompurify"

const URI = /^(?:https?:|mailto:|tel:|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i

const PROSE_OPTIONS = {
  ALLOWED_TAGS: ["#text","p","br","hr","span","div","h1","h2","h3","h4","h5","h6","strong","b","em","i","u","s","sub","sup","mark","small","ul","ol","li","blockquote","pre","code","a","img","figure","figcaption","table","thead","tbody","tfoot","tr","th","td","caption"],
  ALLOWED_ATTR: ["href","target","rel","title","src","alt","width","height","loading","colspan","rowspan","class","id","lang","dir","style"],
  KEEP_CONTENT: false,
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  FORBID_TAGS: ["script","style","iframe","object","embed","form","input","svg","math"],
  FORBID_ATTR: ["srcset","formaction","xlink:href"],
}

const SVG_OPTIONS = {
  USE_PROFILES: { svg: true, svgFilters: true },
  // <use> is not in DOMPurify's SVG profile - dropped there because its
  // href can pull external content - but sprite references, <use
  // href="#symbol">, are how Framer ships icons. So the tag comes back and
  // the walker below holds every href in icon mode to a #fragment, which
  // reaches nothing outside the document.
  ADD_TAGS: ["use"],
  ADD_ATTR: ["href"],
  ALLOWED_URI_REGEXP: URI,
  FORBID_TAGS: ["script", "foreignObject", "animate", "set"],
  FORBID_ATTR: ["xlink:href"],
}

const SNAPSHOT_OPTIONS = {
  USE_PROFILES: { html: true, svg: true, svgFilters: true },
  ADD_TAGS: ["canvas", "use"],
  ALLOWED_URI_REGEXP: URI,
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "foreignObject"],
  FORBID_ATTR: ["srcset", "formaction", "xlink:href"],
}

const ATTR: Record<string, string> = {
  "class": "className",
  "for": "htmlFor",
  "colspan": "colSpan",
  "rowspan": "rowSpan",
  "maxlength": "maxLength",
  "tabindex": "tabIndex",
  "srcset": "srcSet",
  "usemap": "useMap"
}

const VOID = new Set(["br","hr","img"])
const PROSE_TAGS = new Set(PROSE_OPTIONS.ALLOWED_TAGS.filter(t => t !== "#text"))
const PROSE_CSS = new Set(["color","background-color","text-align","text-decoration","text-decoration-line","text-decoration-color","text-transform","vertical-align","font-weight","font-style","font-size","font-family","font-variant","line-height","letter-spacing","word-spacing","white-space"])

type Policy = {
  /** Extra gate on top of the sanitizer; null means trust its allowlist. */
  tagOk: ((tag: string) => boolean) | null
  /** Prose keeps only the properties prose is made of; graphics keep more. */
  styleOk: (prop: string) => boolean
  /** SVG attributes are case-sensitive - viewBox must stay viewBox. */
  keepCase: boolean
  /** Icons may only reference within the document: href must be #fragment. */
  fragmentHref: boolean
}

const PROSE: Policy = { tagOk: t => PROSE_TAGS.has(t), styleOk: p => PROSE_CSS.has(p), keepCase: false, fragmentHref: false }
const GRAPHIC: Policy = { tagOk: null, styleOk: () => true, keepCase: true, fragmentHref: true }
// A sealed section is a page fragment, not an icon: links in it keep their
// destinations, which DOMPurify's URI regexp has already vetted.
const SEALED: Policy = { tagOk: null, styleOk: () => true, keepCase: true, fragmentHref: false }

/**
 * No value may load or run, whatever its property. url(#...) is allowed -
 * that is an SVG gradient or clip reference, and a fragment reaches nothing
 * outside the document - and any other url( is refused.
 */
function valueOk(value: string): boolean {
  if (/expression|javascript:|\\/i.test(value)) return false
  return value.replace(/url\(\s*(["']?)#/gi, "").search(/url\s*\(/i) === -1
}

function toStyle(text: string, policy: Policy): Record<string, string> | null {
  const out: Record<string, string> = {}
  for (const decl of text.split(";")) {
    const colon = decl.indexOf(":")
    if (colon < 0) continue
    const prop = decl.slice(0, colon).trim().toLowerCase()
    const value = decl.slice(colon + 1).trim()
    if (!value || !valueOk(value)) continue
    if (prop.startsWith("--")) { out[prop] = value; continue }
    if (!policy.styleOk(prop)) continue
    out[prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value
  }
  return Object.keys(out).length ? out : null
}

function toElement(node: Node, key: number, policy: Policy): React.ReactNode {
  if (node.nodeType === 3) return node.nodeValue
  if (node.nodeType !== 1) return null
  const el = node as Element
  const tag = el.tagName.toLowerCase()
  if (policy.tagOk && !policy.tagOk(tag)) return null
  // SVG element names are case-sensitive: clipPath, linearGradient.
  const name = policy.keepCase && el.namespaceURI === "http://www.w3.org/2000/svg" ? el.tagName : tag
  const props: Record<string, unknown> = { key }
  for (const attr of Array.from(el.attributes)) {
    const lower = attr.name.toLowerCase()
    if (lower.startsWith("on")) continue
    if (lower === "href" && policy.fragmentHref && !attr.value.startsWith("#")) continue
    if (lower === "style") {
      const style = toStyle(attr.value, policy)
      if (style) props.style = style
      continue
    }
    const spelled = policy.keepCase ? attr.name : lower
    props[ATTR[lower] ?? spelled] = attr.value
  }
  if (VOID.has(tag)) return React.createElement(name, props)
  const children = Array.from(el.childNodes)
    .map((child, i) => toElement(child, i, policy))
    .filter(child => child !== null && child !== "")
  return React.createElement(name, props, ...children)
}

function render(html: string | null | undefined, options: object, policy: Policy): React.ReactNode[] {
  const fragment = DOMPurify.sanitize(String(html ?? ""), {
    ...options,
    RETURN_DOM_FRAGMENT: true,
  }) as unknown as DocumentFragment
  return Array.from(fragment.childNodes)
    .map((node, i) => toElement(node, i, policy))
    .filter(node => node !== null && node !== "") as React.ReactNode[]
}

type Props = React.ComponentPropsWithoutRef<"div"> & { html: string | null | undefined }

/** A Framer formatted-text field. Prose tags, prose styling, nothing else. */
export default function RichText({ html, ...rest }: Props) {
  return <div {...rest}>{render(html, PROSE_OPTIONS, PROSE)}</div>
}

/** An icon captured off the published page. Shapes survive; scripts do not. */
export function SvgGraphic({ html, ...rest }: Props) {
  return <div {...rest}>{render(html, SVG_OPTIONS, GRAPHIC)}</div>
}

/** A sealed section kept for pixel fidelity. Layout survives; script does not. */
export function Snapshot({ html, ...rest }: Props) {
  return <div {...rest}>{render(html, SNAPSHOT_OPTIONS, SEALED)}</div>
}
