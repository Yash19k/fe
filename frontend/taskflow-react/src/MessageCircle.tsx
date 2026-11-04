import styles from "./styles.module.css"
import { SvgGraphic } from "./RichText"

export default function MessageCircle({ slots = [] }: { slots?: string[] }) {
  return (
      <SvgGraphic className={styles["team-chat-icon"]} html={"<svg aria-hidden=\"true\" data-framer-name=\"Team Chat icon\" class=\"framer-uAULH framer-128ui8b\" role=\"presentation\" viewBox=\"0 0 24 24\" style=\"--1m973uw: var(--token-58f62a67-15de-4e6e-b079-00f80c0704c1); --js9iwy: 2; opacity: 1;\" data-f2c-idx=\"200\"><use href=\"#1298086186\" data-f2c-idx=\"201\"></use></svg>"} />
  )
}
