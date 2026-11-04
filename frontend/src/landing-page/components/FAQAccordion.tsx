import styles from "../styles/styles.module.css"
import States from "./States"

export default function FAQAccordion({ slots = [] }: { slots?: string[] }) {
  return (
      <States
        a={<>
          <div className={styles["open"]}>
            <div className={styles["question"]}>
              <div className={styles["div-45"]}>
                <h6 className={styles["h6"]}>{"What is TaskFlow?"}</h6>
              </div>
              <div className={styles["plus"]}>
                <div className={styles["div-46"]} />
                <div className={styles["div-47"]} />
              </div>
            </div>
            <div className={styles["line"]} />
            <div className={styles["answer"]}>
              <div className={styles["div-48"]}>
                <p className={styles["p-50"]}>{"TaskFlow is a project management and team collaboration platform that helps teams manage projects, organize tasks, coordinate workflows, and track delivery from one workspace."}</p>
              </div>
            </div>
          </div>
        </>}
        b={<>
          <div className={styles["close"]}>
            <div className={styles["question-2"]}>
              <div className={styles["div-45"]}>
                <h6 className={styles["h6"]}>{"What is TaskFlow?"}</h6>
              </div>
              <div className={styles["plus-2"]}>
                <div className={styles["div-49"]} />
                <div className={styles["div-50"]} />
              </div>
            </div>
          </div>
        </>}
      />
  )
}
