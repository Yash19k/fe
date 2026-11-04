import styles from "../styles/styles.module.css"
import ClientLogoTicker from "./ClientLogoTicker"

export default function FeatureStrip({ slots = [] }: { slots?: string[] }) {
  return (
    <div className={styles["logos"]}>
      <div className={styles["container-3"]}>
        <div className={styles["heading-5"]}>
          <h5 className={styles["h5-3"]}>{slots[0] ?? "One workspace. Every project. Your whole team."}</h5>
        </div>
        <div className={styles["logos-2"]}>
          <div className={styles["client-logos"]}>
            <div className={styles["div-63"]}>
              <div className={styles["div-75"]}>
                <ClientLogoTicker slots={[]} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

