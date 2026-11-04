import styles from "./styles.module.css"

export default function LogoFloating2({ slots = [] }: { slots?: string[] }) {
  return (
      <div className={styles["logo-mirror-2"]}>
        <div className={styles["div-8"]}>
          <div className={styles["div-9"]}>
            <img className={styles["img-2"]} src={slots[0] ?? "https://framerusercontent.com/images/kl9iyzbjdfDhAtxyRmTXKP2O3g.png?width=1254&height=1254"} alt="" />
          </div>
        </div>
      </div>
  )
}
