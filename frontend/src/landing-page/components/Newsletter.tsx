import styles from "../styles/styles.module.css"
import avatar1 from "../../assets/landing/feature-avatar-1.png"
import avatar2 from "../../assets/landing/feature-avatar-2.png"

export default function Newsletter({ slots = [] }: { slots?: string[] }) {
  return (
    <section className={styles["newsletter"]}>
      <div className={styles["container-9"]}>
        <div className={styles["newsletter-2"] + " " + styles["rv-3"]} data-reveal style={{ transitionDelay: "215ms" }}>
          <div className={styles["image"]}>
            <div className={styles["div-87"]}>
              <img className={styles["img-4"]} src={slots[0] ?? avatar1} alt="" loading="lazy" />
            </div>
          </div>
          <div className={styles["image-2"]}>
            <div className={styles["div-87"]}>
              <img className={styles["img-4"]} src={slots[1] ?? avatar1} alt="" loading="lazy" />
            </div>
          </div>
          <div className={styles["image-container-4"] + " " + styles["rv-12"]} data-reveal>
            <div className={styles["image-3"]}>
              <div className={styles["div-88"]}>
                <img className={styles["img-5"]} src={slots[2] ?? avatar2} alt="" loading="lazy" />
              </div>
            </div>
          </div>
          <div className={styles["image-container-5"] + " " + styles["rv-13"]} data-reveal>
            <div className={styles["image-4"]}>
              <div className={styles["div-89"]}>
                <img className={styles["img-6"]} src={slots[3] ?? avatar2} alt="" loading="lazy" />
              </div>
            </div>
          </div>
          <div className={styles["content-8"]}>
            <div className={styles["heading-text-2"]}>
              <div className={styles["heading-9"] + " " + styles["rv-3"]} data-reveal style={{ transitionDelay: "108ms" }}>
                <h2 className={styles["h2-4"]}>{slots[4] ?? "Stay connected with TaskFlow."}</h2>
              </div>
              <div className={styles["text-9"] + " " + styles["rv-11"]} data-reveal style={{ transitionDelay: "215ms" }}>
                <p className={styles["p-121"]}>{slots[5] ?? "Get product updates, project management insights, and practical ideas to help your team work better."}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

