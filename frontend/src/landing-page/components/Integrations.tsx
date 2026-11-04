import styles from "../styles/styles.module.css"
import TickerPath from "./TickerPath"

export default function Integrations({ slots = [] }: { slots?: string[] }) {
  return (
    <section id="integrations" className={styles["integrations-2"]}>
      <div className={styles["container-7"]}>
        <div className={styles["integration"] + " " + styles["rv-3"]} data-reveal>
          <div className={styles["div-84"]}>
            <TickerPath slots={[]} />
          </div>
          <div className={styles["wrapper-5"]}>
            <div className={styles["content-7"]}>
              <div className={styles["div-63"]}>
                <div className={styles["div-85"]}>
                  <div className={styles["01-3"]}>
                    <div className={styles["text-7"]}>
                      <p className={styles["p-119"]}>{slots[89] ?? "ONE CONNECTED WORKSPACE"}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles["heading-text"]}>
                <div className={styles["heading-8"]}>
                  <h2 className={styles["h2-3"]}>{slots[90] ?? "Everything your team needs, working together."}</h2>
                </div>
                <div className={styles["text-8"]}>
                  <p className={styles["p-120"]}>{slots[91] ?? "Bring project planning, task management, conversations, collaborative whiteboards, and delivery tracking into one connected workspace."}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

