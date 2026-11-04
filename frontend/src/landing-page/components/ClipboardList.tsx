import styles from "../styles/styles.module.css"
import { SvgGraphic } from "./RichText"

export default function ClipboardList({ slots = [] }: { slots?: string[] }) {
  return (
      <SvgGraphic className={styles["tasks-icon"]} html={"<svg aria-hidden=\"true\" data-framer-name=\"Tasks icon\" class=\"framer-T13M8 framer-1e5rpkr\" role=\"presentation\" viewBox=\"0 0 24 24\" style=\"--1m973uw: var(--token-58f62a67-15de-4e6e-b079-00f80c0704c1); --js9iwy: 2; opacity: 1;\" data-f2c-idx=\"192\"><use href=\"#2932616460\" data-f2c-idx=\"193\"></use></svg>"} />
  )
}
