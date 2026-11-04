import styles from "./styles.module.css"

export default function Button({ slots = [] }: { slots?: string[] }) {
  return (
      <a className={styles["button"]}>
        <div className={styles["div-2"]}>
          <p className={styles["p-9"]}>{slots[0] ?? "Get Started"}</p>
        </div>
        <div className={styles["div-3"]}>
          <div className={styles["div-4"]}>
            <div className={styles["p-10"]}>
              <span className={styles["span-3"]}>{slots[1] ?? "G"}</span>
              <span className={styles["span-4"]}>{slots[2] ?? "e"}</span>
              <span className={styles["span-5"]}>{slots[3] ?? "t"}</span>
              <div className={styles["span-6"]} />
              <span className={styles["span-4"]}>{slots[4] ?? "S"}</span>
              <span className={styles["span-5"]}>{slots[5] ?? "t"}</span>
              <span className={styles["span-4"]}>{slots[6] ?? "a"}</span>
              <span className={styles["span-7"]}>{slots[7] ?? "r"}</span>
              <span className={styles["span-5"]}>{slots[8] ?? "t"}</span>
              <span className={styles["span-4"]}>{slots[9] ?? "e"}</span>
              <span className={styles["span-4"]}>{slots[10] ?? "d"}</span>
            </div>
          </div>
        </div>
      </a>
  )
}
