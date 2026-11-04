import React from "react"
import styles from "../styles/styles.module.css"

export interface TaskFlowLogoIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string
  style?: React.CSSProperties
}

/**
 * Official TaskFlow Pro flowing TF symbol from the Framer landing page.
 * Preserves the exact icon shape, viewBox (0 0 84 64), colors (#126DFB, #24BDD9, #3848C9),
 * and transparent background.
 */
export function TaskFlowLogoIcon({
  className,
  style,
  width = "100%",
  height = "100%",
  ...props
}: TaskFlowLogoIconProps) {
  return (
    <svg
      viewBox="0 0 84 64"
      preserveAspectRatio="none"
      width={width}
      height={height}
      role="img"
      aria-label="TaskFlow Pro flowing TF symbol"
      className={className}
      style={{ width: "100%", height: "100%", ...style }}
      {...props}
    >
      <title>TaskFlow Pro</title>
      <path
        fill="#126DFB"
        d="M4 20C6 11 12 6 23 6H55L51 18H33L25 46C23 55 17 60 8 60L20 20Z"
      />
      <path
        fill="#24BDD9"
        d="M48 6H80C78 15 73 20 65 20H54L51 31H70C68 39 63 44 55 44H47L43 60H30L41 22C43 14 48 9 56 6Z"
      />
      <path
        fill="#3848C9"
        d="M48 6H56C54 15 49 20 40 20L42 14C43 10 45 8 48 6Z"
      />
    </svg>
  )
}

export interface TaskFlowBrandProps {
  variant?: "nav" | "footer"
  wordmark?: string
  href?: string
  onClick?: (e: React.MouseEvent) => void
}

/**
 * Reusable brand identity component for the public landing page.
 * Used consistently across main desktop navigation, mobile navigation, and footer.
 */
export function TaskFlowBrand({
  variant = "nav",
  wordmark = "TaskFlow",
  href = "#hero",
  onClick,
}: TaskFlowBrandProps) {
  if (variant === "footer") {
    return (
      <div className={styles["taskflow-pro-brand"]}>
        <div className={styles["taskflow-logo-2"]}>
          <div className={styles["div-59"]}>
            <div className={styles["svg-9"]}>
              <TaskFlowLogoIcon />
            </div>
          </div>
        </div>
        <div className={styles["taskflow-pro"]}>
          <div className={styles["p-56"]} />
          <div className={styles["p-57"]}>
            <span className={styles["span-36"]}>{wordmark}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <a className={styles["taskflow-brand"]} href={href} onClick={onClick}>
      <div className={styles["taskflow-logo"]}>
        <div className={styles["div"]}>
          <div className={styles["svg"]}>
            <TaskFlowLogoIcon />
          </div>
        </div>
      </div>
      <div className={styles["taskflow"]}>
        <div className={styles["p"]} />
        <div className={styles["p-2"]}>
          <span className={styles["span"]}>{wordmark}</span>
        </div>
      </div>
    </a>
  )
}

export default TaskFlowBrand

