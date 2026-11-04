import styles from "./styles.module.css"
import { SvgGraphic } from "./RichText"

export default function BenefitCard({ slots = [] }: { slots?: string[] }) {
  return (
      <div className={styles["desktop-4"]}>
        <div className={styles["icon-container"]}>
          <div className={styles["collaboration-mini-illustration"]}>
            <div className={styles["team-indicators"]}>
              <div className={styles["member-j"]}>
                <div className={styles["j"]}>
                  <div className={styles["p-46"]}>
                    <span className={styles["span-31"]}>{slots[0] ?? "J"}</span>
                  </div>
                </div>
              </div>
              <div className={styles["member-j"]}>
                <div className={styles["a"]}>
                  <div className={styles["p-47"]}>
                    <span className={styles["span-31"]}>{slots[1] ?? "A"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className={styles["refined-feature-artwork"]}>
            <div className={styles["collaboration-overlapping-avatars-and-conversation"]}>
              <div className={styles["div-23"]}>
                <SvgGraphic className={styles["svg-7"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 32 32\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"701\"><use href=\"#svg1913215000_680\" data-f2c-idx=\"702\"></use></svg>"} />
              </div>
            </div>
          </div>
        </div>
        <div className={styles["content-3"]}>
          <div className={styles["heading-2"]}>
            <h5 className={styles["h5"]}>{slots[2] ?? "Real-Time Collaboration"}</h5>
          </div>
          <div className={styles["text-3"]}>
            <p className={styles["p-48"]}>{slots[3] ?? "Keep your team connected through shared conversations and live collaboration."}</p>
          </div>
        </div>
      </div>
  )
}
