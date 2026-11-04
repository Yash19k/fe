"use client"

import { useEffect } from "react"

/**
 * Marks an element the first time it is on screen. Everything about how it
 * moves - where from, how long - is in the stylesheet, measured from the
 * published page; this only says when.
 */
export default function RevealWatcher() {
  useEffect(() => {
    const els = document.querySelectorAll("[data-reveal]")
    if (!("IntersectionObserver" in window)) {
      els.forEach(el => el.setAttribute("data-in", ""))
      return
    }
    const seen = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.setAttribute("data-in", "")
          seen.unobserve(entry.target)
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    )
    els.forEach(el => seen.observe(el))
    return () => seen.disconnect()
  }, [])
  return null
}
