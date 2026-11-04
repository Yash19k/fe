import styles from "./styles.module.css"
import { SvgGraphic } from "./RichText"

export default function BenefitCard2({ slots = [] }: { slots?: string[] }) {
  return (
      <div className={styles["desktop-5"]}>
        <div className={styles["icon-container"]}>
          <div className={styles["collaboration-mini-illustration"]}>
            <div className={styles["delivery-status"]} />
            <div className={styles["deadline-track"]} />
            <div className={styles["deadline-track-secondary"]} />
          </div>
          <div className={styles["refined-feature-artwork-2"]}>
            <div className={styles["collaboration-overlapping-avatars-and-conversation"]}>
              <div className={styles["div-23"]}>
                <SvgGraphic className={styles["svg-7"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 32 32\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"796\"><use href=\"#svg-1087771581_789\" data-f2c-idx=\"797\"></use></svg>"} />
              </div>
            </div>
          </div>
        </div>
        <div className={styles["content-4"]}>
          <div className={styles["heading-3"]}>
            <h5 className={styles["h5-2"]}>{slots[0] ?? "Organized Delivery"}</h5>
          </div>
          <div className={styles["text-4"]}>
            <p className={styles["p-49"]}>{slots[1] ?? "Manage sprints, deadlines, SLA commitments, and escalations in a structured workflow."}</p>
          </div>
        </div>
      </div>
  )
}
