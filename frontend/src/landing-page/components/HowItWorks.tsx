import styles from "../styles/styles.module.css"
import Seperator from "./Seperator"

export default function HowItWorks({ slots = [] }: { slots?: string[] }) {
  return (
    <section id="how-it-works" className={styles["how-it-works-2"]}>
      <div className={styles["container-6"]}>
        <div className={styles["div-63"]}>
          <div className={styles["div-76"]}>
            <Seperator slots={["HOW TASKFLOW WORKS","From planning to completion, all in three steps.","Organize your work, bring your team together, and track progress through every stage of delivery."]} />
          </div>
        </div>
        <div className={styles["cards-3"]}>
          <div className={styles["top-4"]}>
            {/* Step 1 */}
            <div className={styles["how-it-works-3"] + " " + styles["rv-3"]} data-reveal>
              <div className={styles["image-container-2"]}>
                <div className={styles["div-82"]}>
                  <div className={styles["soft-illustration-backdrop-2"]} />
                  <div className={styles["organize-projects-illustration"]}>
                    <div className={styles["connected-project-overview-2"]}>
                      <div className={styles["workspace-heading-2"]}>
                        <div className={styles["project-overview-2"]}>
                          <div className={styles["p-89"]}>
                            <span className={styles["span-51"]}>{slots[42] ?? "Project overview"}</span>
                          </div>
                        </div>
                        <div className={styles["team-member-pm-2"]}>
                          <div className={styles["pm"]}>
                            <div className={styles["p-90"]}>
                              <span className={styles["span-52"]}>{slots[43] ?? "PM"}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className={styles["projects-and-progress-2"]}>
                        <div className={styles["my-tasks-3"]}>
                          <div className={styles["my-tasks-4"]}>
                            <div className={styles["p-91"]}>
                              <span className={styles["span-11"]}>{slots[44] ?? "My Tasks"}</span>
                            </div>
                          </div>
                          <div className={styles["task-project-brief-2"]}>
                            <div className={styles["task-status-2"]} />
                            <div className={styles["project-brief-3"]}>
                              <div className={styles["p-92"]}>
                                <span className={styles["span-53"]}>{slots[45] ?? "Project brief"}</span>
                              </div>
                            </div>
                          </div>
                          <div className={styles["task-project-brief-2"]}>
                            <div className={styles["task-status-3"]} />
                            <div className={styles["project-brief-3"]}>
                              <div className={styles["p-92"]}>
                                <span className={styles["span-53"]}>{slots[46] ?? "Design review"}</span>
                              </div>
                            </div>
                          </div>
                          <div className={styles["launch-checklist-3"]}>
                            <div className={styles["task-project-brief-2"]}>
                              <div className={styles["launch-checklist-4"]}>
                                <div className={styles["p-93"]}>
                                  <span className={styles["span-11"]}>{slots[47] ?? "Launch checklist"}</span>
                                </div>
                              </div>
                              <div className={styles["72"]}>
                                <div className={styles["p-20"]}>
                                  <span className={styles["span-13"]}>{slots[48] ?? "72%"}</span>
                                </div>
                              </div>
                            </div>
                            <div className={styles["progress-track-3"]}>
                              <div className={styles["completed-work-3"]} />
                            </div>
                          </div>
                        </div>
                        <div className={styles["project-summary-2"]}>
                          <div className={styles["space-below-floating-project-status-2"]} />
                          <div className={styles["12-18-2"]}>
                            <div className={styles["p-94"]}>
                              <span className={styles["span-54"]}>{slots[49] ?? "12 / 18"}</span>
                            </div>
                          </div>
                          <div className={styles["tasks-complete-2"]}>
                            <div className={styles["p-95"]}>
                              <span className={styles["span-15"]}>{slots[50] ?? "tasks complete"}</span>
                            </div>
                          </div>
                          <div className={styles["project-progress-chart-3"]}>
                            <div className={styles["progress-bar-1-3"]} />
                            <div className={styles["progress-bar-2-3"]} />
                            <div className={styles["progress-bar-3-3"]} />
                            <div className={styles["progress-bar-4-3"]} />
                          </div>
                        </div>
                      </div>
                      <div className={styles["team-activity-2"]}>
                        <div className={styles["team-members-2"]}>
                          <div className={styles["team-member-jd-2"]}>
                            <div className={styles["jd"]}>
                              <div className={styles["p-23"]}>
                                <span className={styles["span-16"]}>{slots[51] ?? "JD"}</span>
                              </div>
                            </div>
                          </div>
                          <div className={styles["team-member-al-2"]}>
                            <div className={styles["al"]}>
                              <div className={styles["p-24"]}>
                                <span className={styles["span-17"]}>{slots[52] ?? "AL"}</span>
                              </div>
                            </div>
                          </div>
                          <div className={styles["team-member-mk-2"]}>
                            <div className={styles["mk"]}>
                              <div className={styles["p-25"]}>
                                <span className={styles["span-18"]}>{slots[53] ?? "MK"}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className={styles["product-team-2"]}>
                          <div className={styles["p-96"]}>
                            <span className={styles["span-55"]}>{slots[54] ?? "Product team"}</span>
                          </div>
                        </div>
                      </div>
                      <div className={styles["active-projects-status-2"]}>
                        <div className={styles["website-launch-2"]}>
                          <div className={styles["p-97"]}>
                            <span className={styles["span-19"]}>{slots[55] ?? "Website launch"}</span>
                          </div>
                        </div>
                        <div className={styles["in-progress-badge-2"]}>
                          <div className={styles["in-progress-2"]}>
                            <div className={styles["p-28"]}>
                              <span className={styles["span-21"]}>{slots[56] ?? "In progress"}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className={styles["upcoming-deadline-2"]}>
                      <div className={styles["upcoming-deadline-label-2"]}>
                        <div className={styles["upcoming-deadline-3"]}>
                          <div className={styles["p-98"]}>
                            <span className={styles["span-15"]}>{slots[57] ?? "Upcoming deadline"}</span>
                          </div>
                        </div>
                        <div className={styles["design-review-tomorrow-2"]}>
                          <div className={styles["website-launch-2"]}>
                            <div className={styles["p-30"]}>
                              <span className={styles["span-22"]}>{slots[58] ?? "Design review"}</span>
                            </div>
                          </div>
                          <div className={styles["tomorrow-2"]}>
                            <div className={styles["p-31"]}>
                              <span className={styles["span-23"]}>{slots[59] ?? "Tomorrow"}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles["top-5"]}>
                <div className={styles["heading-6"]}>
                  <h4 className={styles["h4-2"]}>{slots[0] ?? "Organize Your Projects"}</h4>
                </div>
                <div className={styles["description"]}>
                  <p className={styles["p-99"]}>{slots[60] ?? "Create projects, add tasks, assign responsibilities, and configure workflows that suit your team."}</p>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className={styles["how-it-works-4"] + " " + styles["rv-3"]} data-reveal style={{ transitionDelay: "204ms" }}>
              <div className={styles["image-container-3"]}>
                <div className={styles["div-83"]}>
                  <div className={styles["soft-illustration-backdrop-3"]} />
                  <div className={styles["collaborate-with-the-team-illustration"]}>
                    <div className={styles["collaborative-whiteboard-2"]}>
                      <div className={styles["team-whiteboard-2"]}>
                        <div className={styles["p-100"]}>
                          <span className={styles["span-56"]}>{slots[61] ?? "Team whiteboard"}</span>
                        </div>
                      </div>
                      <div className={styles["connected-ideas-2"]}>
                        <div className={styles["plan-whiteboard-node-2"]}>
                          <div className={styles["plan-2"]}>
                            <div className={styles["p-101"]}>
                              <span className={styles["span-57"]}>{slots[62] ?? "Plan"}</span>
                            </div>
                          </div>
                        </div>
                        <div className={styles["idea-connector-3"]} />
                        <div className={styles["build-whiteboard-node-2"]}>
                          <div className={styles["build-2"]}>
                            <div className={styles["p-102"]}>
                              <span className={styles["span-58"]}>{slots[63] ?? "Build"}</span>
                            </div>
                          </div>
                        </div>
                        <div className={styles["idea-connector-3"]} />
                        <div className={styles["review-whiteboard-node-2"]}>
                          <div className={styles["build-2"]}>
                            <div className={styles["p-103"]}>
                              <span className={styles["span-43"]}>{slots[64] ?? "Review"}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className={styles["alex-is-editing-3"]}>
                        <div className={styles["alex-is-editing-2"]}>
                          <div className={styles["p-70"]}>
                            <span className={styles["span-25"]}>{slots[65] ?? "Alex is editing"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className={styles["team-chat-message-2"]}>
                      <div className={styles["message-sender-2"]}>
                        <div className={styles["team-member-jd-3"]}>
                          <div className={styles["jd"]}>
                            <div className={styles["p-23"]}>
                              <span className={styles["span-16"]}>{slots[66] ?? "JD"}</span>
                            </div>
                          </div>
                        </div>
                        <div className={styles["jordan-2"]}>
                          <div className={styles["p-104"]}>
                            <span className={styles["span-59"]}>{slots[67] ?? "Jordan"}</span>
                          </div>
                        </div>
                        <div className={styles["online-now-2"]} />
                      </div>
                      <div className={styles["the-project-plan-is-ready-2"]}>
                        <div className={styles["p-105"]}>
                          <span className={styles["span-11"]}>{slots[68] ?? "The project plan is ready."}</span>
                        </div>
                      </div>
                    </div>
                    <div className={styles["new-team-message-3"]}>
                      <div className={styles["new-message-notification-2"]}>
                        <div className={styles["team-member-al-3"]}>
                          <div className={styles["al"]}>
                            <div className={styles["p-24"]}>
                              <span className={styles["span-17"]}>{slots[69] ?? "AL"}</span>
                            </div>
                          </div>
                        </div>
                        <div className={styles["message-summary-2"]}>
                          <div className={styles["new-team-message-4"]}>
                            <div className={styles["p-106"]}>
                              <span className={styles["span-60"]}>{slots[70] ?? "New team message"}</span>
                            </div>
                          </div>
                          <div className={styles["alex-shared-a-whiteboard-update-2"]}>
                            <div className={styles["p-107"]}>
                              <span className={styles["span-15"]}>{slots[71] ?? "Alex shared a whiteboard update."}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles["top-6"]}>
                <div className={styles["heading-7"]}>
                  <h4 className={styles["h4-3"]}>{slots[72] ?? "Collaborate and Execute"}</h4>
                </div>
                <div className={styles["description-2"]}>
                  <p className={styles["p-108"]}>{slots[73] ?? "Work together through shared project views, team chat, comments, and collaborative whiteboards."}</p>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className={styles["how-it-works-3"] + " " + styles["rv-3"]} data-reveal style={{ transitionDelay: "399ms" }}>
              <div className={styles["image-container-2"]}>
                <div className={styles["div-82"]}>
                  <div className={styles["soft-illustration-backdrop-2"]} />
                  <div className={styles["organize-projects-illustration"]}>
                    <div className={styles["delivery-workspace-2"]}>
                      <div className={styles["sprint-header-2"]}>
                        <div className={styles["sprint-04-2"]}>
                          <div className={styles["p-109"]}>
                            <span className={styles["span-51"]}>{slots[74] ?? "Sprint 04"}</span>
                          </div>
                        </div>
                        <div className={styles["sla-on-track-3"]}>
                          <div className={styles["sla-on-track-2"]}>
                            <div className={styles["p-76"]}>
                              <span className={styles["span-26"]}>{slots[75] ?? "SLA on track"}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className={styles["workflow-progression-2"]}>
                        <div className={styles["to-do-stage-2"]}>
                          <div className={styles["to-do-3"]}>
                            <div className={styles["p-110"]}>
                              <span className={styles["span-61"]}>{slots[76] ?? "To do"}</span>
                            </div>
                          </div>
                        </div>
                        <div className={styles["in-progress-stage-2"]}>
                          <div className={styles["in-progress-4"]}>
                            <div className={styles["p-111"]}>
                              <span className={styles["span-47"]}>{slots[77] ?? "In progress"}</span>
                            </div>
                          </div>
                        </div>
                        <div className={styles["in-review-stage-2"]}>
                          <div className={styles["to-do-3"]}>
                            <div className={styles["p-112"]}>
                              <span className={styles["span-62"]}>{slots[78] ?? "In review"}</span>
                            </div>
                          </div>
                        </div>
                        <div className={styles["done-stage-2"]}>
                          <div className={styles["in-progress-4"]}>
                            <div className={styles["p-113"]}>
                              <span className={styles["span-49"]}>{slots[79] ?? "Done"}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className={styles["sprint-progress-and-chart-2"]}>
                        <div className={styles["sprint-completion-2"]}>
                          <div className={styles["sprint-progress-3"]}>
                            <div className={styles["progress-label-2"]}>
                              <div className={styles["sprint-progress-4"]}>
                                <div className={styles["p-114"]}>
                                  <span className={styles["span-11"]}>{slots[80] ?? "Sprint progress"}</span>
                                </div>
                              </div>
                              <div className={styles["72"]}>
                                <div className={styles["p-115"]}>
                                  <span className={styles["span-63"]}>{slots[81] ?? "76%"}</span>
                                </div>
                              </div>
                            </div>
                            <div className={styles["progress-track-4"]}>
                              <div className={styles["completed-work-4"]} />
                            </div>
                          </div>
                          <div className={styles["current-task-2"]}>
                            <div className={styles["team-member-mk-3"]}>
                              <div className={styles["mk"]}>
                                <div className={styles["p-25"]}>
                                  <span className={styles["span-18"]}>{slots[82] ?? "MK"}</span>
                                </div>
                              </div>
                            </div>
                            <div className={styles["review-release-notes-2"]}>
                              <div className={styles["p-116"]}>
                                <span className={styles["span-64"]}>{slots[83] ?? "Review release notes"}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className={styles["completion-chart-2"]}>
                          <div className={styles["project-progress-chart-4"]}>
                            <div className={styles["progress-bar-1-4"]} />
                            <div className={styles["progress-bar-2-4"]} />
                            <div className={styles["progress-bar-3-4"]} />
                            <div className={styles["progress-bar-4-4"]} />
                            <div className={styles["progress-bar-5-4"]} />
                            <div className={styles["progress-bar-6-4"]} />
                            <div className={styles["progress-bar-7-4"]} />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className={styles["deadline-reminder-3"]}>
                      <div className={styles["deadline-reminder-4"]}>
                        <div className={styles["p-117"]}>
                          <span className={styles["span-15"]}>{slots[84] ?? "Deadline reminder"}</span>
                        </div>
                      </div>
                      <div className={styles["delivery-milestone-2"]}>
                        <div className={styles["sprint-review-2"]}>
                          <div className={styles["p-118"]}>
                            <span className={styles["span-55"]}>{slots[85] ?? "Sprint review"}</span>
                          </div>
                        </div>
                        <div className={styles["fri-16-00-3"]}>
                          <div className={styles["fri-16-00-2"]}>
                            <div className={styles["p-86"]}>
                              <span className={styles["span-21"]}>{slots[86] ?? "Fri, 16:00"}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles["top-5"]}>
                <div className={styles["heading-6"]}>
                  <h4 className={styles["h4-2"]}>{slots[87] ?? "Track and Deliver"}</h4>
                </div>
                <div className={styles["description"]}>
                  <p className={styles["p-99"]}>{slots[88] ?? "Monitor project progress, manage sprints, follow deadlines, and keep your team aligned through delivery."}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

