import styles from "../styles/styles.module.css"

export default function Github({ slots = [] }: { slots?: string[] }) {
  return (
      <div className={styles["github"]} />
  )
}
