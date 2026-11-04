import styles from "./styles.module.css"

export default function LogoFloating({ slots = [] }: { slots?: string[] }) {
  return (
      <div className={styles["logo-mirror"]}>
        <div className={styles["div-6"]}>
          <div className={styles["div-7"]}>
            <img className={styles["img"]} src={slots[0] ?? "https://framerusercontent.com/images/F41yn7x91OCcRjAPP1ZGlqlqwGM.png?width=1254&height=1254"} alt="" />
          </div>
        </div>
      </div>
  )
}
