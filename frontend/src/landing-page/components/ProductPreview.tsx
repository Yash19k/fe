import styles from "../styles/styles.module.css"
import { SvgGraphic } from "./RichText"
import dashboardPreviewImg from "../../assets/landing/dashboard-preview.png"

export default function ProductPreview({ slots = [] }: { slots?: string[] }) {
  return (
    <div className={styles["dashboard"]}>
      <div className={styles["container-2"]}>
        <div className={styles["img-container"]}>
          <div className={styles["div-63"]}>
            <div className={styles["div-72"]}>
              <div className={styles["div-73"]}>
                <img
                  className={styles["img-3"]}
                  src={slots[0] ?? dashboardPreviewImg}
                  alt="TaskFlow Pro Workspace Dashboard Preview"
                  loading="eager"
                />
              </div>
              <div className={styles["taskflow-logo-preview-branding"]}>
                <div className={styles["div-74"]}>
                  <SvgGraphic className={styles["svg-10"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 1555 1011\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"165\"><use href=\"#svg1269902988_571\" data-f2c-idx=\"166\"></use></svg>"} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

