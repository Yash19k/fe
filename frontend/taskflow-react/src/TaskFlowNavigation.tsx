import styles from "./styles.module.css"
import { SvgGraphic } from "./RichText"

export default function TaskFlowNavigation({ slots = [] }: { slots?: string[] }) {
  return (
      <nav className={styles["desktop"]}>
        <div className={styles["navigation-content"]}>
          <div className={styles["brand-and-menu"]}>
            <a className={styles["taskflow-brand"]} href="./#hero">
              <div className={styles["taskflow-logo"]}>
                <div className={styles["div"]}>
                  <SvgGraphic className={styles["svg"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 84 64\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"12\"><use href=\"#svg-348115219_472\" data-f2c-idx=\"13\"></use></svg>"} />
                </div>
              </div>
              <div className={styles["taskflow"]}>
                <div className={styles["p"]} />
                <div className={styles["p-2"]}>
                  <span className={styles["span"]}>{slots[0] ?? "TaskFlow"}</span>
                </div>
              </div>
            </a>
          </div>
          <div className={styles["links-and-get-started"]}>
            <div className={styles["section-links"]}>
              <a className={styles["features"]} href="./#features">
                <div className={styles["features-label"]}>
                  <div className={styles["p-3"]}>
                    <span className={styles["span-2"]}>{slots[1] ?? "Features"}</span>
                  </div>
                </div>
              </a>
              <a className={styles["benefits"]} href="./#benefits">
                <div className={styles["benefits-label"]}>
                  <div className={styles["p-4"]}>
                    <span className={styles["span-2"]}>{slots[2] ?? "Benefits"}</span>
                  </div>
                </div>
              </a>
              <a className={styles["how-it-works"]} href="./#how-it-works">
                <div className={styles["how-it-works-label"]}>
                  <div className={styles["p-5"]}>
                    <span className={styles["span-2"]}>{slots[3] ?? "How It Works"}</span>
                  </div>
                </div>
              </a>
              <a className={styles["integrations"]} href="./#integrations">
                <div className={styles["integrations-label"]}>
                  <div className={styles["p-6"]}>
                    <span className={styles["span-2"]}>{slots[4] ?? "Integrations"}</span>
                  </div>
                </div>
              </a>
              <a className={styles["faq"]} href="./#faq">
                <div className={styles["faq-label"]}>
                  <div className={styles["p-7"]}>
                    <span className={styles["span-2"]}>{slots[5] ?? "FAQ"}</span>
                  </div>
                </div>
              </a>
              <a className={styles["resources"]} href="./">
                <div className={styles["resources-label"]}>
                  <div className={styles["p-8"]}>
                    <span className={styles["span-2"]}>{slots[6] ?? "Resources"}</span>
                  </div>
                </div>
              </a>
            </div>
            <div className={styles["get-started-configure-signup-url"]}>
              <a className={styles["button"]}>
                <div className={styles["div-2"]}>
                  <p className={styles["p-9"]}>{slots[7] ?? "Get Started"}</p>
                </div>
                <div className={styles["div-3"]}>
                  <div className={styles["div-4"]}>
                    <div className={styles["p-10"]}>
                      <span className={styles["span-3"]}>{slots[8] ?? "G"}</span>
                      <span className={styles["span-4"]}>{slots[9] ?? "e"}</span>
                      <span className={styles["span-5"]}>{slots[10] ?? "t"}</span>
                      <div className={styles["span-6"]} />
                      <span className={styles["span-4"]}>{slots[11] ?? "S"}</span>
                      <span className={styles["span-5"]}>{slots[12] ?? "t"}</span>
                      <span className={styles["span-4"]}>{slots[13] ?? "a"}</span>
                      <span className={styles["span-7"]}>{slots[14] ?? "r"}</span>
                      <span className={styles["span-5"]}>{slots[15] ?? "t"}</span>
                      <span className={styles["span-4"]}>{slots[16] ?? "e"}</span>
                      <span className={styles["span-4"]}>{slots[17] ?? "d"}</span>
                    </div>
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>
      </nav>
  )
}
