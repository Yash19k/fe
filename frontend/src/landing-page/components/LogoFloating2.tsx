import styles from "../styles/styles.module.css"
import defaultLogoFloat2 from "../../assets/landing/logo-float-2.png"

export default function LogoFloating2({ slots = [] }: { slots?: string[] }) {
  return (
      <div className={styles["div-8"]}>
        <div className={styles["div-9"]}>
          <div className={styles["img-wrapper"]}>
            <img className={styles["img-2"]} src={slots[0] ?? defaultLogoFloat2} alt="" />
          </div>
        </div>
      </div>
  )
}

