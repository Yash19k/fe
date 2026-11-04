import styles from "./styles.module.css"
import { SvgGraphic } from "./RichText"

export default function FolderKanban({ slots = [] }: { slots?: string[] }) {
  return (
      <SvgGraphic className={styles["projects-icon"]} html={"<svg aria-hidden=\"true\" data-framer-name=\"Projects icon\" class=\"framer-HvqYl framer-1mihqdf\" role=\"presentation\" viewBox=\"0 0 24 24\" style=\"--1m973uw: var(--token-58f62a67-15de-4e6e-b079-00f80c0704c1); --js9iwy: 2; opacity: 1;\" data-f2c-idx=\"184\"><use href=\"#2014752541\" data-f2c-idx=\"185\"></use></svg>"} />
  )
}
