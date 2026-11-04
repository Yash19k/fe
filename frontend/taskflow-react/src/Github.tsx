import styles from "./styles.module.css"

export default function Github({ slots = [] }: { slots?: string[] }) {
  return (
      <div className={styles["github"]} />
  )
}
