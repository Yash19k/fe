import styles from "../styles/styles.module.css"
import Seperator from "./Seperator"
import BenefitCard from "./BenefitCard"
import BenefitCard2 from "./BenefitCard2"
import { SvgGraphic } from "./RichText"

export default function Benefits({ slots = [] }: { slots?: string[] }) {
  return (
    <section id="benefits" className={styles["benefits-2"]}>
      <div className={styles["container-5"]}>
        <div className={styles["div-63"]}>
          <div className={styles["div-76"]}>
            <Seperator slots={["WHY TASKFLOW","Everything stays connected. Everyone stays aligned.","Give your team the clarity and coordination it needs to move projects forward without switching between disconnected tools."]} />
          </div>
        </div>
        <div className={styles["cards-2"]}>
          <div className={styles["top-3"]}>
            <div className={styles["div-63"]}>
              <div className={styles["div-79"] + " " + styles["rv-3"]} data-reveal style={{ transitionDelay: "1758ms" }}>
                <BenefitCard slots={["J","A","Real-Time Collaboration","Keep your team connected through shared conversations and live collaboration."]} />
              </div>
            </div>
            <div className={styles["div-63"]}>
              <div className={styles["div-80"] + " " + styles["rv-3"]} data-reveal style={{ transitionDelay: "1867ms" }}>
                <div className={styles["desktop-8"]}>
                  <div className={styles["icon-container"]}>
                    <div className={styles["collaboration-mini-illustration"]}>
                      <div className={styles["task-row-1"]} />
                      <div className={styles["task-row-2"]} />
                      <div className={styles["task-row-2"]} />
                    </div>
                    <div className={styles["refined-feature-artwork-3"]}>
                      <div className={styles["collaboration-overlapping-avatars-and-conversation"]}>
                        <div className={styles["div-23"]}>
                          <SvgGraphic className={styles["svg-7"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 32 32\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"719\"><use href=\"#svg-505428859_670\" data-f2c-idx=\"720\"></use></svg>"} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={styles["content-6"]}>
                    <div className={styles["heading-3"]}>
                      <h5 className={styles["h5-2"]}>{slots[33] ?? "Centralized Workspace"}</h5>
                    </div>
                    <div className={styles["text-6"]}>
                      <p className={styles["p-87"]}>{slots[34] ?? "Bring projects, tasks, updates, and deadlines together in one place."}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles["div-63"]}>
              <div className={styles["div-80"] + " " + styles["rv-3"]} data-reveal style={{ transitionDelay: "1950ms" }}>
                <div className={styles["desktop-8"]}>
                  <div className={styles["icon-container"]}>
                    <div className={styles["collaboration-mini-illustration"]}>
                      <div className={styles["workflow-stage"]} />
                      <div className={styles["connector"]} />
                      <div className={styles["linked-stages"]}>
                        <div className={styles["next-stage-0"]} />
                        <div className={styles["next-stage-0"]} />
                      </div>
                    </div>
                    <div className={styles["refined-feature-artwork-4"]}>
                      <div className={styles["collaboration-overlapping-avatars-and-conversation"]}>
                        <div className={styles["div-23"]}>
                          <SvgGraphic className={styles["svg-7"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 32 32\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"739\"><use href=\"#svg1191453966_717\" data-f2c-idx=\"740\"></use></svg>"} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={styles["content-6"]}>
                    <div className={styles["heading-3"]}>
                      <h5 className={styles["h5-2"]}>{slots[35] ?? "Flexible Workflows"}</h5>
                    </div>
                    <div className={styles["text-6"]}>
                      <p className={styles["p-87"]}>{slots[36] ?? "Adapt project statuses and workflows to match the way your team works."}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className={styles["bottom-2"] + " " + styles["rv-3"]} data-reveal style={{ transitionDelay: "1758ms" }}>
            <div className={styles["div-63"]}>
              <div className={styles["div-79"] + " " + styles["rv-3"]} data-reveal style={{ transitionDelay: "1950ms" }}>
                <div className={styles["desktop-4"]}>
                  <div className={styles["icon-container"]}>
                    <div className={styles["collaboration-mini-illustration"]}>
                      <div className={styles["team-indicators"]}>
                        <div className={styles["member-jd"]}>
                          <div className={styles["jd-2"]}>
                            <div className={styles["p-88"]}>
                              <span className={styles["span-31"]}>{slots[37] ?? "JD"}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className={styles["refined-feature-artwork-5"]}>
                      <div className={styles["collaboration-overlapping-avatars-and-conversation"]}>
                        <div className={styles["div-23"]}>
                          <SvgGraphic className={styles["svg-7"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 32 32\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"760\"><use href=\"#svg-131389556_475\" data-f2c-idx=\"761\"></use></svg>"} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={styles["content-3"]}>
                    <div className={styles["heading-2"]}>
                      <h5 className={styles["h5"]}>{slots[38] ?? "Clear Ownership"}</h5>
                    </div>
                    <div className={styles["text-3"]}>
                      <p className={styles["p-48"]}>{slots[39] ?? "Assign responsibilities and give team members visibility into their work."}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles["div-63"]}>
              <div className={styles["div-80"] + " " + styles["rv-3"]} data-reveal style={{ transitionDelay: "2034ms" }}>
                <div className={styles["desktop-8"]}>
                  <div className={styles["icon-container"]}>
                    <div className={styles["visibility-mini-illustration"]}>
                      <div className={styles["progress-0"]} />
                      <div className={styles["progress-1"]} />
                      <div className={styles["progress-2"]} />
                    </div>
                    <div className={styles["refined-feature-artwork-6"]}>
                      <div className={styles["collaboration-overlapping-avatars-and-conversation"]}>
                        <div className={styles["div-23"]}>
                          <SvgGraphic className={styles["svg-7"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 32 32\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"778\"><use href=\"#svg-1225756127_559\" data-f2c-idx=\"779\"></use></svg>"} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={styles["content-6"]}>
                    <div className={styles["heading-3"]}>
                      <h5 className={styles["h5-2"]}>{slots[40] ?? "Better Project Visibility"}</h5>
                    </div>
                    <div className={styles["text-6"]}>
                      <p className={styles["p-87"]}>{slots[41] ?? "Track progress through multiple views and understand where every project stands."}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles["div-63"]}>
              <div className={styles["div-81"] + " " + styles["rv-3"]} data-reveal style={{ transitionDelay: "2149ms" }}>
                <BenefitCard2 slots={["Organized Delivery","Manage sprints, deadlines, SLA commitments, and escalations in a structured workflow."]} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

