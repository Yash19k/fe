import styles from "../styles/styles.module.css"
import { SvgGraphic } from "./RichText"

export default function Presentation({ slots = [] }: { slots?: string[] }) {
  return (
      <SvgGraphic className={styles["whiteboard-icon"]} html={"<svg aria-hidden=\"true\" data-framer-name=\"Whiteboard icon\" class=\"framer-J0kin framer-1g297k\" role=\"presentation\" viewBox=\"0 0 24 24\" style=\"--1m973uw: var(--token-58f62a67-15de-4e6e-b079-00f80c0704c1); --js9iwy: 2; opacity: 1;\" data-f2c-idx=\"208\"><use href=\"#2126520362\" data-f2c-idx=\"209\"></use></svg>"} />
  )
}
