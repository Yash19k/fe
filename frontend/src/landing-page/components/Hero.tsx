import styles from "../styles/styles.module.css"
import LogoFloating from "./LogoFloating"
import LogoFloating2 from "./LogoFloating2"
import Button from "./Button"
import Button2 from "./Button2"
import logoFloat1 from "../../assets/landing/logo-float-1.png"
import logoFloat2 from "../../assets/landing/logo-float-2.png"
import logoFloat3 from "../../assets/landing/logo-float-3.png"
import logoFloat4 from "../../assets/landing/logo-float-4.png"

export default function Hero({ slots = [] }: { slots?: string[] }) {
  return (
    <section id="hero" className={styles["hero"]}>
      <div className={styles["hero-dot-grid-radial-fade"]}>
        <div className={styles["div-66"]}>
          <div className={styles["div-67"]} />
          <div className={styles["canvas"]} />
        </div>
      </div>
      <div className={styles["container"]}>
        <div className={styles["wrapper"]}>
          <div className={styles["div-68"]}>
            <LogoFloating slots={[logoFloat1]} />
          </div>
        </div>
        <div className={styles["wrapper-2"]}>
          <div className={styles["div-69"]}>
            <LogoFloating2 slots={[logoFloat2]} />
          </div>
        </div>
        <div className={styles["wrapper-3"]}>
          <div className={styles["div-70"]}>
            <LogoFloating slots={[logoFloat3]} />
          </div>
        </div>
        <div className={styles["wrapper-4"]}>
          <div className={styles["div-71"]}>
            <LogoFloating2 slots={[logoFloat4]} />
          </div>
        </div>
        <div className={styles["content-5"]}>
          <div className={styles["top"]}>
            <div className={styles["tag"]}>
              <div className={styles["text-5"]}>
                <p className={styles["p-64"]}>{slots[0] ?? "PROJECT MANAGEMENT, CONNECTED"}</p>
              </div>
            </div>
            <div className={styles["text-container-2"]}>
              <div className={styles["div-63"]}>
                <div className={styles["heading-4"]}>
                  <h1 className={styles["h1"]}>{slots[1] ?? "Bring every project, task, and conversation into one workspace."}</h1>
                </div>
              </div>
              <div className={styles["div-22"]}>
                <p className={styles["p-65"]}>{slots[2] ?? "Plan projects, organize tasks, collaborate with your team, and track progress with TaskFlow. Everything your team needs to move work forward, all in one place."}</p>
              </div>
            </div>
          </div>
          <div className={styles["bottom"]}>
            <div className={styles["hero-actions"]}>
              <div className={styles["div-63"]}>
                <div className={styles["get-started-configure-signup-url"]}>
                  <Button slots={["Get Started","G","e","t","S","t","a","r","t","e","d"]} />
                </div>
              </div>
              <div className={styles["div-63"]}>
                <div className={styles["explore-features-3"]}>
                  <Button2 slots={["Explore Features","E","x","p","l","o","r","e","F","e","a","t","u","r","e","s"]} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

