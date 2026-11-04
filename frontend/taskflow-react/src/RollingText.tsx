import styles from "./styles.module.css"

export default function RollingText({ slots = [] }: { slots?: string[] }) {
  return (
      <div className={styles["div-4"]}>
        <div className={styles["p-10"]}>
          <span className={styles["span-3"]}>{slots[0] ?? "G"}</span>
          <span className={styles["span-4"]}>{slots[1] ?? "e"}</span>
          <span className={styles["span-5"]}>{slots[2] ?? "t"}</span>
          <div className={styles["span-6"]} />
          <span className={styles["span-4"]}>{slots[3] ?? "S"}</span>
          <span className={styles["span-5"]}>{slots[4] ?? "t"}</span>
          <span className={styles["span-4"]}>{slots[5] ?? "a"}</span>
          <span className={styles["span-7"]}>{slots[6] ?? "r"}</span>
          <span className={styles["span-5"]}>{slots[7] ?? "t"}</span>
          <span className={styles["span-4"]}>{slots[8] ?? "e"}</span>
          <span className={styles["span-4"]}>{slots[9] ?? "d"}</span>
        </div>
      </div>
  )
}
