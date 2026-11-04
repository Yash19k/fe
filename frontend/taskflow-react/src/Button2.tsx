import styles from "./styles.module.css"

export default function Button2({ slots = [] }: { slots?: string[] }) {
  return (
      <a className={styles["button-2"]} href="./">
        <div className={styles["div-10"]}>
          <p className={styles["p-11"]}>{slots[0] ?? "Explore Features"}</p>
        </div>
        <div className={styles["div-11"]}>
          <div className={styles["div-12"]}>
            <div className={styles["p-12"]}>
              <span className={styles["span-8"]}>{slots[1] ?? "E"}</span>
              <span className={styles["span-8"]}>{slots[2] ?? "x"}</span>
              <span className={styles["span-4"]}>{slots[3] ?? "p"}</span>
              <span className={styles["span-6"]}>{slots[4] ?? "l"}</span>
              <span className={styles["span-4"]}>{slots[5] ?? "o"}</span>
              <span className={styles["span-7"]}>{slots[6] ?? "r"}</span>
              <span className={styles["span-4"]}>{slots[7] ?? "e"}</span>
              <div className={styles["span-6"]} />
              <span className={styles["span-8"]}>{slots[8] ?? "F"}</span>
              <span className={styles["span-4"]}>{slots[9] ?? "e"}</span>
              <span className={styles["span-4"]}>{slots[10] ?? "a"}</span>
              <span className={styles["span-5"]}>{slots[11] ?? "t"}</span>
              <span className={styles["span-4"]}>{slots[12] ?? "u"}</span>
              <span className={styles["span-7"]}>{slots[13] ?? "r"}</span>
              <span className={styles["span-4"]}>{slots[14] ?? "e"}</span>
              <span className={styles["span-8"]}>{slots[15] ?? "s"}</span>
            </div>
          </div>
        </div>
      </a>
  )
}
