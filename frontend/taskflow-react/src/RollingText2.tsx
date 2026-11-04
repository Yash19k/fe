import styles from "./styles.module.css"

export default function RollingText2({ slots = [] }: { slots?: string[] }) {
  return (
      <div className={styles["div-12"]}>
        <div className={styles["p-12"]}>
          <span className={styles["span-8"]}>{slots[0] ?? "E"}</span>
          <span className={styles["span-8"]}>{slots[1] ?? "x"}</span>
          <span className={styles["span-4"]}>{slots[2] ?? "p"}</span>
          <span className={styles["span-6"]}>{slots[3] ?? "l"}</span>
          <span className={styles["span-4"]}>{slots[4] ?? "o"}</span>
          <span className={styles["span-7"]}>{slots[5] ?? "r"}</span>
          <span className={styles["span-4"]}>{slots[6] ?? "e"}</span>
          <div className={styles["span-6"]} />
          <span className={styles["span-8"]}>{slots[7] ?? "F"}</span>
          <span className={styles["span-4"]}>{slots[8] ?? "e"}</span>
          <span className={styles["span-4"]}>{slots[9] ?? "a"}</span>
          <span className={styles["span-5"]}>{slots[10] ?? "t"}</span>
          <span className={styles["span-4"]}>{slots[11] ?? "u"}</span>
          <span className={styles["span-7"]}>{slots[12] ?? "r"}</span>
          <span className={styles["span-4"]}>{slots[13] ?? "e"}</span>
          <span className={styles["span-8"]}>{slots[14] ?? "s"}</span>
        </div>
      </div>
  )
}
