import styles from "./styles.module.css"
import { SvgGraphic } from "./RichText"

export default function TaskFlowProFooter({ slots = [] }: { slots?: string[] }) {
  return (
      <div className={styles["desktop-7"]}>
        <div className={styles["final-call-to-action"]}>
          <div className={styles["call-to-action-content"]}>
            <div className={styles["ready-to-bring-your-team-s-work-together"]}>
              <h2 className={styles["h2-2"]}>
                <span className={styles["span-32"]}>{slots[0] ?? "Ready to bring your team’s work together?"}</span>
              </h2>
            </div>
            <div className={styles["plan-projects-manage-tasks-collaborate-with-your-team-and-keep-every-project-moving-forward-with-taskflow-pro"]}>
              <div className={styles["p-52"]}>
                <span className={styles["span-33"]}>{slots[1] ?? "Plan projects, manage tasks, collaborate with your team, and keep every project moving forward with TaskFlow Pro."}</span>
              </div>
            </div>
            <div className={styles["cta-buttons"]}>
              <div className={styles["get-started-configure-create-account-url"]}>
                <a className={styles["button-3"]}>
                  <div className={styles["div-56"]}>
                    <p className={styles["p-53"]}>{slots[2] ?? "Get Started →"}</p>
                  </div>
                  <div className={styles["div-57"]}>
                    <div className={styles["div-58"]}>
                      <div className={styles["p-54"]}>
                        <span className={styles["span-3"]}>{slots[3] ?? "G"}</span>
                        <span className={styles["span-4"]}>{slots[4] ?? "e"}</span>
                        <span className={styles["span-5"]}>{slots[5] ?? "t"}</span>
                        <div className={styles["span-6"]} />
                        <span className={styles["span-4"]}>{slots[6] ?? "S"}</span>
                        <span className={styles["span-5"]}>{slots[7] ?? "t"}</span>
                        <span className={styles["span-4"]}>{slots[8] ?? "a"}</span>
                        <span className={styles["span-7"]}>{slots[9] ?? "r"}</span>
                        <span className={styles["span-5"]}>{slots[10] ?? "t"}</span>
                        <span className={styles["span-4"]}>{slots[11] ?? "e"}</span>
                        <span className={styles["span-4"]}>{slots[12] ?? "d"}</span>
                        <div className={styles["span-6"]} />
                        <span className={styles["span-34"]}>{slots[13] ?? "→"}</span>
                      </div>
                    </div>
                  </div>
                </a>
              </div>
              <a className={styles["explore-features"]} href="./#features">
                <div className={styles["explore-features-2"]}>
                  <div className={styles["p-55"]}>
                    <span className={styles["span-35"]}>{slots[14] ?? "Explore Features"}</span>
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>
        <div className={styles["footer-navigation"]}>
          <div className={styles["footer-content"]}>
            <div className={styles["footer-columns"]}>
              <div className={styles["brand"]}>
                <div className={styles["taskflow-pro-brand"]}>
                  <div className={styles["taskflow-logo-2"]}>
                    <div className={styles["div-59"]}>
                      <SvgGraphic className={styles["svg-9"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 84 64\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"1465\"><use href=\"#svg-348115219_472\" data-f2c-idx=\"1466\"></use></svg>"} />
                    </div>
                  </div>
                  <div className={styles["taskflow-pro"]}>
                    <div className={styles["p-56"]} />
                    <div className={styles["p-57"]}>
                      <span className={styles["span-36"]}>{slots[15] ?? "TaskFlow"}</span>
                    </div>
                  </div>
                </div>
                <div className={styles["one-connected-workspace-for-projects-tasks-sprints-and-team-collaboration"]}>
                  <div className={styles["p-58"]}>
                    <span className={styles["span-37"]}>{slots[16] ?? "One connected workspace for projects, tasks, sprints, and team collaboration."}</span>
                  </div>
                </div>
                <div className={styles["social-profiles"]}>
                  <a className={styles["github-configure-url"]}>
                    <div className={styles["github"]} />
                  </a>
                  <a className={styles["github-configure-url"]}>
                    <div className={styles["github"]} />
                  </a>
                  <a className={styles["github-configure-url"]}>
                    <div className={styles["github"]} />
                  </a>
                </div>
              </div>
              <div className={styles["product"]}>
                <div className={styles["product-2"]}>
                  <h3 className={styles["h3"]}>
                    <span className={styles["span-38"]}>{slots[17] ?? "Product"}</span>
                  </h3>
                </div>
                <a className={styles["features-2"]} href="./#features">
                  <div className={styles["features-3"]}>
                    <div className={styles["p-59"]}>
                      <span className={styles["span-39"]}>{slots[18] ?? "Features"}</span>
                    </div>
                  </div>
                </a>
                <a className={styles["features-2"]} href="./#features">
                  <div className={styles["features-3"]}>
                    <div className={styles["p-59"]}>
                      <span className={styles["span-39"]}>{slots[19] ?? "Project Management"}</span>
                    </div>
                  </div>
                </a>
                <a className={styles["features-2"]} href="./#features">
                  <div className={styles["features-3"]}>
                    <div className={styles["p-59"]}>
                      <span className={styles["span-39"]}>{slots[20] ?? "Task Management"}</span>
                    </div>
                  </div>
                </a>
                <a className={styles["features-2"]} href="./#features">
                  <div className={styles["features-3"]}>
                    <div className={styles["p-59"]}>
                      <span className={styles["span-39"]}>{slots[21] ?? "Board View"}</span>
                    </div>
                  </div>
                </a>
                <a className={styles["timeline-configure-url"]}>
                  <div className={styles["timeline"]}>
                    <div className={styles["p-60"]}>
                      <span className={styles["span-37"]}>{slots[22] ?? "Timeline"}</span>
                    </div>
                  </div>
                </a>
                <a className={styles["features-2"]} href="./#features">
                  <div className={styles["features-3"]}>
                    <div className={styles["p-59"]}>
                      <span className={styles["span-39"]}>{slots[23] ?? "Sprint Planning"}</span>
                    </div>
                  </div>
                </a>
                <a className={styles["features-2"]} href="./#benefits">
                  <div className={styles["features-3"]}>
                    <div className={styles["p-59"]}>
                      <span className={styles["span-39"]}>{slots[24] ?? "Collaboration"}</span>
                    </div>
                  </div>
                </a>
              </div>
              <div className={styles["resources-2"]}>
                <div className={styles["product-2"]}>
                  <h3 className={styles["h3"]}>
                    <span className={styles["span-38"]}>{slots[25] ?? "Resources"}</span>
                  </h3>
                </div>
                <a className={styles["features-2"]} href="./#how-it-works">
                  <div className={styles["features-3"]}>
                    <div className={styles["p-59"]}>
                      <span className={styles["span-39"]}>{slots[26] ?? "How It Works"}</span>
                    </div>
                  </div>
                </a>
                <a className={styles["features-2"]} href="./#faq">
                  <div className={styles["features-3"]}>
                    <div className={styles["p-59"]}>
                      <span className={styles["span-39"]}>{slots[27] ?? "Frequently Asked Questions"}</span>
                    </div>
                  </div>
                </a>
                <a className={styles["timeline-configure-url"]}>
                  <div className={styles["timeline"]}>
                    <div className={styles["p-60"]}>
                      <span className={styles["span-37"]}>{slots[28] ?? "Contact"}</span>
                    </div>
                  </div>
                </a>
              </div>
              <div className={styles["resources-2"]}>
                <div className={styles["product-2"]}>
                  <h3 className={styles["h3"]}>
                    <span className={styles["span-38"]}>{slots[29] ?? "Get Started"}</span>
                  </h3>
                </div>
                <a className={styles["timeline-configure-url"]}>
                  <div className={styles["timeline"]}>
                    <div className={styles["p-60"]}>
                      <span className={styles["span-37"]}>{slots[30] ?? "Sign In"}</span>
                    </div>
                  </div>
                </a>
                <a className={styles["timeline-configure-url"]}>
                  <div className={styles["timeline"]}>
                    <div className={styles["p-60"]}>
                      <span className={styles["span-37"]}>{slots[31] ?? "Create Account"}</span>
                    </div>
                  </div>
                </a>
                <a className={styles["timeline-configure-url"]}>
                  <div className={styles["timeline"]}>
                    <div className={styles["p-60"]}>
                      <span className={styles["span-37"]}>{slots[32] ?? "Get Started"}</span>
                    </div>
                  </div>
                </a>
              </div>
            </div>
            <div className={styles["copyright-and-legal"]}>
              <div className={styles["2026-taskflow-pro-all-rights-reserved"]}>
                <div className={styles["p-61"]}>
                  <span className={styles["span-40"]}>{slots[33] ?? "© 2026 TaskFlow Pro. All rights reserved."}</span>
                </div>
              </div>
              <div className={styles["legal-links"]}>
                <a className={styles["privacy-policy-configure-url"]}>
                  <div className={styles["privacy-policy"]}>
                    <div className={styles["p-62"]}>
                      <span className={styles["span-41"]}>{slots[34] ?? "Privacy Policy"}</span>
                    </div>
                  </div>
                </a>
                <a className={styles["terms-of-service-configure-url"]}>
                  <div className={styles["terms-of-service"]}>
                    <div className={styles["p-63"]}>
                      <span className={styles["span-41"]}>{slots[35] ?? "Terms of Service"}</span>
                    </div>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
  )
}
