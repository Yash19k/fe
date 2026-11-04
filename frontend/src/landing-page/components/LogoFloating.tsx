import styles from "../styles/styles.module.css"
import defaultLogoFloat from "../../assets/landing/logo-float-1.png"

export default function LogoFloating({ slots = [] }: { slots?: string[] }) {
  return (
      <div className={styles["div-8"]}>
        <div className={styles["div-9"]}>
          <div className={styles["img-wrapper"]}>
            <img className={styles["img"]} src={slots[0] ?? defaultLogoFloat} alt="" />
          </div>
        </div>
      </div>
  )
}

