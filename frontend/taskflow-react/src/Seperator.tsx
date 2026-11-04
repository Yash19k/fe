import styles from "./styles.module.css"

export default function Seperator({ slots = [] }: { slots?: string[] }) {
  return (
      <div className={styles["01"]}>
        <div className={styles["div-18"] + " " + styles["rv-2"]} data-reveal>
          <div className={styles["01-2"]}>
            <div className={styles["text"]}>
              <p className={styles["p-13"]}>{slots[0] ?? "EVERYTHING YOUR TEAM NEEDS"}</p>
            </div>
          </div>
        </div>
        <div className={styles["text-container"]}>
          <div className={styles["heading"] + " " + styles["rv-3"]} data-reveal style={{ transitionDelay: "116ms" }}>
            <h2 className={styles["h2"]}>{slots[1] ?? "Make every part of your workflow work together."}</h2>
          </div>
          <div className={styles["text-2"] + " " + styles["rv-3"]} data-reveal style={{ transitionDelay: "198ms" }}>
            <p className={styles["p-14"]}>{slots[2] ?? "From planning and execution to communication and delivery, TaskFlow brings your team’s work into one connected platform."}</p>
          </div>
        </div>
      </div>
  )
}
