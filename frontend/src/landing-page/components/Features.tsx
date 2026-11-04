import styles from "../styles/styles.module.css"
import Seperator from "./Seperator"
import FeaturesCard from "./FeaturesCard"
import FeaturesCard2 from "./FeaturesCard2"

export default function Features({ slots = [] }: { slots?: string[] }) {
  return (
    <section id="features" className={styles["features-4"]}>
      <div className={styles["container-4"]}>
        <div className={styles["div-63"]}>
          <div className={styles["div-76"]}>
            <Seperator slots={["EVERYTHING YOUR TEAM NEEDS","Make every part of your workflow work together.","From planning and execution to communication and delivery, TaskFlow brings your team’s work into one connected platform."]} />
          </div>
        </div>
        <div className={styles["cards"]}>
          <div className={styles["top-2"]}>
            <div className={styles["div-63"]}>
              <div className={styles["div-77"] + " " + styles["rv-11"]} data-reveal>
                <FeaturesCard slots={["Project overview","PM","My Tasks","Project brief","Design review","Launch checklist","72%","12 / 18","tasks complete","JD","AL","MK","Product team","Website launch","In progress","Upcoming deadline","Design review","Tomorrow","AL","Centralized Project Management","Manage projects, tasks, priorities, assignees, deadlines, and progress from one organized workspace."]} />
              </div>
            </div>
            <div className={styles["div-63"]}>
              <div className={styles["div-78"] + " " + styles["rv-11"]} data-reveal style={{ transitionDelay: "221ms" }}>
                <FeaturesCard2 slots={["To do","Project brief","Normal","JD","Assign owners","In progress","Build views","High","MK","Check deadlines","In review","Design review","Normal","AL","Review updates","Done","Plan sprint","Normal","PM","Share handoff","List","Board","Timeline","Calendar","Sprint","Project timeline","W1","W2","W3","W4","Flexible Project Views","Switch between List, Kanban Board, Timeline, Calendar, and Sprint views to manage work the way your team prefers."]} />
              </div>
            </div>
          </div>
          <div className={styles["top-2"]}>
            <div className={styles["div-63"]}>
              <div className={styles["div-78"] + " " + styles["rv-11"]} data-reveal style={{ transitionDelay: "641ms" }}>
                <div className={styles["desktop-3"]}>
                  <div className={styles["image-container"]}>
                    <div className={styles["div-19"]}>
                      <div className={styles["soft-illustration-backdrop"]} />
                      <div className={styles["centralized-projects-infographic"]}>
                        <div className={styles["collaborative-whiteboard"]}>
                          <div className={styles["team-whiteboard"]}>
                            <div className={styles["p-66"]}>
                              <span className={styles["span-42"]}>{slots[5] ?? "Team whiteboard"}</span>
                            </div>
                          </div>
                          <div className={styles["connected-ideas"]}>
                            <div className={styles["plan-whiteboard-node"]}>
                              <div className={styles["plan"]}>
                                <div className={styles["p-67"]}>
                                  <span className={styles["span-43"]}>{slots[6] ?? "Plan"}</span>
                                </div>
                              </div>
                            </div>
                            <div className={styles["idea-connector"]} />
                            <div className={styles["build-whiteboard-node"]}>
                              <div className={styles["build"]}>
                                <div className={styles["p-68"]}>
                                  <span className={styles["span-44"]}>{slots[7] ?? "Build"}</span>
                                </div>
                              </div>
                            </div>
                            <div className={styles["idea-connector-2"]} />
                            <div className={styles["review-whiteboard-node"]}>
                              <div className={styles["plan"]}>
                                <div className={styles["p-69"]}>
                                  <span className={styles["span-45"]}>{slots[8] ?? "Review"}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className={styles["alex-is-editing"]}>
                            <div className={styles["alex-is-editing-2"]}>
                              <div className={styles["p-70"]}>
                                <span className={styles["span-25"]}>{slots[9] ?? "Alex is editing"}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className={styles["team-chat-message"]}>
                          <div className={styles["message-sender"]}>
                            <div className={styles["team-member-jd"]}>
                              <div className={styles["jd"]}>
                                <div className={styles["p-23"]}>
                                  <span className={styles["span-16"]}>{slots[10] ?? "JD"}</span>
                                </div>
                              </div>
                            </div>
                            <div className={styles["jordan"]}>
                              <div className={styles["p-71"]}>
                                <span className={styles["span-29"]}>{slots[11] ?? "Jordan"}</span>
                              </div>
                            </div>
                            <div className={styles["online-now"]} />
                          </div>
                          <div className={styles["the-project-plan-is-ready"]}>
                            <div className={styles["p-72"]}>
                              <span className={styles["span-11"]}>{slots[12] ?? "The project plan is ready."}</span>
                            </div>
                          </div>
                        </div>
                        <div className={styles["new-team-message"]}>
                          <div className={styles["new-message-notification"]}>
                            <div className={styles["team-member-al"]}>
                              <div className={styles["al"]}>
                                <div className={styles["p-24"]}>
                                  <span className={styles["span-17"]}>{slots[13] ?? "AL"}</span>
                                </div>
                              </div>
                            </div>
                            <div className={styles["message-summary"]}>
                              <div className={styles["new-team-message-2"]}>
                                <div className={styles["p-73"]}>
                                  <span className={styles["span-29"]}>{slots[14] ?? "New team message"}</span>
                                </div>
                              </div>
                              <div className={styles["alex-shared-a-whiteboard-update"]}>
                                <div className={styles["p-74"]}>
                                  <span className={styles["span-15"]}>{slots[15] ?? "Alex shared a whiteboard update."}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={styles["content-2"]}>
                    <div className={styles["div-20"]}>
                      <h4 className={styles["h4"]}>{slots[16] ?? "Real-Time Team Collaboration"}</h4>
                    </div>
                    <div className={styles["div-22"]}>
                      <p className={styles["p-45"]}>{slots[17] ?? "Keep conversations connected to your work with team chat, project communication, and collaborative whiteboards."}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles["div-63"]}>
              <div className={styles["div-78"] + " " + styles["rv-11"]} data-reveal style={{ transitionDelay: "841ms" }}>
                <div className={styles["desktop-3"]}>
                  <div className={styles["image-container"]}>
                    <div className={styles["div-19"]}>
                      <div className={styles["soft-illustration-backdrop"]} />
                      <div className={styles["centralized-projects-infographic"]}>
                        <div className={styles["delivery-workspace"]}>
                          <div className={styles["sprint-header"]}>
                            <div className={styles["sprint-04"]}>
                              <div className={styles["p-75"]}>
                                <span className={styles["span-9"]}>{slots[18] ?? "Sprint 04"}</span>
                              </div>
                            </div>
                            <div className={styles["sla-on-track"]}>
                              <div className={styles["sla-on-track-2"]}>
                                <div className={styles["p-76"]}>
                                  <span className={styles["span-26"]}>{slots[19] ?? "SLA on track"}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className={styles["workflow-progression"]}>
                            <div className={styles["to-do-stage"]}>
                              <div className={styles["to-do-2"]}>
                                <div className={styles["p-77"]}>
                                  <span className={styles["span-46"]}>{slots[20] ?? "To do"}</span>
                                </div>
                              </div>
                            </div>
                            <div className={styles["in-progress-stage"]}>
                              <div className={styles["in-progress-3"]}>
                                <div className={styles["p-78"]}>
                                  <span className={styles["span-47"]}>{slots[21] ?? "In progress"}</span>
                                </div>
                              </div>
                            </div>
                            <div className={styles["in-review-stage"]}>
                              <div className={styles["to-do-2"]}>
                                <div className={styles["p-79"]}>
                                  <span className={styles["span-48"]}>{slots[22] ?? "In review"}</span>
                                </div>
                              </div>
                            </div>
                            <div className={styles["done-stage"]}>
                              <div className={styles["to-do-2"]}>
                                <div className={styles["p-80"]}>
                                  <span className={styles["span-49"]}>{slots[23] ?? "Done"}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className={styles["sprint-progress-and-chart"]}>
                            <div className={styles["sprint-completion"]}>
                              <div className={styles["sprint-progress"]}>
                                <div className={styles["progress-label"]}>
                                  <div className={styles["sprint-progress-2"]}>
                                    <div className={styles["p-81"]}>
                                      <span className={styles["span-11"]}>{slots[24] ?? "Sprint progress"}</span>
                                    </div>
                                  </div>
                                  <div className={styles["72"]}>
                                    <div className={styles["p-82"]}>
                                      <span className={styles["span-50"]}>{slots[25] ?? "76%"}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className={styles["progress-track-2"]}>
                                  <div className={styles["completed-work-2"]} />
                                </div>
                              </div>
                              <div className={styles["current-task"]}>
                                <div className={styles["team-member-mk"]}>
                                  <div className={styles["mk"]}>
                                    <div className={styles["p-25"]}>
                                      <span className={styles["span-18"]}>{slots[26] ?? "MK"}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className={styles["review-release-notes"]}>
                                  <div className={styles["p-83"]}>
                                    <span className={styles["span-15"]}>{slots[27] ?? "Review release notes"}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className={styles["completion-chart"]}>
                              <div className={styles["project-progress-chart-2"]}>
                                <div className={styles["progress-bar-1-2"]} />
                                <div className={styles["progress-bar-2-2"]} />
                                <div className={styles["progress-bar-3-2"]} />
                                <div className={styles["progress-bar-4-2"]} />
                                <div className={styles["progress-bar-5-2"]} />
                                <div className={styles["progress-bar-6-2"]} />
                                <div className={styles["progress-bar-7-2"]} />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className={styles["deadline-reminder"]}>
                          <div className={styles["deadline-reminder-2"]}>
                            <div className={styles["p-84"]}>
                              <span className={styles["span-15"]}>{slots[28] ?? "Deadline reminder"}</span>
                            </div>
                          </div>
                          <div className={styles["delivery-milestone"]}>
                            <div className={styles["sprint-review"]}>
                              <div className={styles["p-85"]}>
                                <span className={styles["span-19"]}>{slots[29] ?? "Sprint review"}</span>
                              </div>
                            </div>
                            <div className={styles["fri-16-00"]}>
                              <div className={styles["fri-16-00-2"]}>
                                <div className={styles["p-86"]}>
                                  <span className={styles["span-21"]}>{slots[30] ?? "Fri, 16:00"}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={styles["content-2"]}>
                    <div className={styles["div-20"]}>
                      <h4 className={styles["h4"]}>{slots[31] ?? "Custom Workflows and Tracking"}</h4>
                    </div>
                    <div className={styles["div-22"]}>
                      <p className={styles["p-45"]}>{slots[32] ?? "Create workflows that match your team’s process, monitor deadlines, and track SLA commitments and escalations."}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

