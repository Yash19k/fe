import styles from "../styles/styles.module.css"

export default function FeaturesCard2({ slots = [] }: { slots?: string[] }) {
  return (
      <div className={styles["desktop-3"]}>
        <div className={styles["image-container"]}>
          <div className={styles["div-19"]}>
            <div className={styles["soft-illustration-backdrop"]} />
            <div className={styles["centralized-projects-infographic"]}>
              <div className={styles["kanban-board"]}>
                <div className={styles["work-stages"]}>
                  <div className={styles["to-do-column"]}>
                    <div className={styles["to-do"]}>
                      <div className={styles["p-33"]}>
                        <span className={styles["span-22"]}>{slots[0] ?? "To do"}</span>
                      </div>
                    </div>
                    <div className={styles["task-card-to-do"]}>
                      <div className={styles["project-brief-2"]}>
                        <div className={styles["p-34"]}>
                          <span className={styles["span-23"]}>{slots[1] ?? "Project brief"}</span>
                        </div>
                      </div>
                      <div className={styles["task-details"]}>
                        <div className={styles["normal"]}>
                          <div className={styles["normal-2"]}>
                            <div className={styles["p-35"]}>
                              <span className={styles["span-20"]}>{slots[2] ?? "Normal"}</span>
                            </div>
                          </div>
                        </div>
                        <div className={styles["team-member-jd-2"]}>
                          <div className={styles["jd"]}>
                            <div className={styles["p-23"]}>
                              <span className={styles["span-16"]}>{slots[3] ?? "JD"}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className={styles["secondary-task-card"]}>
                      <div className={styles["assign-owners"]}>
                        <div className={styles["p-36"]}>
                          <span className={styles["span-24"]}>{slots[4] ?? "Assign owners"}</span>
                        </div>
                      </div>
                      <div className={styles["task-progress"]} />
                    </div>
                  </div>
                  <div className={styles["to-do-column"]}>
                    <div className={styles["to-do"]}>
                      <div className={styles["p-33"]}>
                        <span className={styles["span-22"]}>{slots[5] ?? "In progress"}</span>
                      </div>
                    </div>
                    <div className={styles["task-card-to-do"]}>
                      <div className={styles["project-brief-2"]}>
                        <div className={styles["p-34"]}>
                          <span className={styles["span-23"]}>{slots[6] ?? "Build views"}</span>
                        </div>
                      </div>
                      <div className={styles["task-details"]}>
                        <div className={styles["high"]}>
                          <div className={styles["high-2"]}>
                            <div className={styles["p-37"]}>
                              <span className={styles["span-21"]}>{slots[7] ?? "High"}</span>
                            </div>
                          </div>
                        </div>
                        <div className={styles["team-member-mk-2"]}>
                          <div className={styles["mk"]}>
                            <div className={styles["p-25"]}>
                              <span className={styles["span-18"]}>{slots[8] ?? "MK"}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className={styles["secondary-task-card"]}>
                      <div className={styles["assign-owners"]}>
                        <div className={styles["p-36"]}>
                          <span className={styles["span-24"]}>{slots[9] ?? "Check deadlines"}</span>
                        </div>
                      </div>
                      <div className={styles["task-progress-2"]} />
                    </div>
                  </div>
                  <div className={styles["to-do-column"]}>
                    <div className={styles["to-do"]}>
                      <div className={styles["p-33"]}>
                        <span className={styles["span-22"]}>{slots[10] ?? "In review"}</span>
                      </div>
                    </div>
                    <div className={styles["task-card-to-do"]}>
                      <div className={styles["project-brief-2"]}>
                        <div className={styles["p-34"]}>
                          <span className={styles["span-23"]}>{slots[11] ?? "Design review"}</span>
                        </div>
                      </div>
                      <div className={styles["task-details"]}>
                        <div className={styles["normal-3"]}>
                          <div className={styles["normal-2"]}>
                            <div className={styles["p-38"]}>
                              <span className={styles["span-25"]}>{slots[12] ?? "Normal"}</span>
                            </div>
                          </div>
                        </div>
                        <div className={styles["team-member-al-2"]}>
                          <div className={styles["al"]}>
                            <div className={styles["p-24"]}>
                              <span className={styles["span-17"]}>{slots[13] ?? "AL"}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className={styles["secondary-task-card"]}>
                      <div className={styles["assign-owners"]}>
                        <div className={styles["p-36"]}>
                          <span className={styles["span-24"]}>{slots[14] ?? "Review updates"}</span>
                        </div>
                      </div>
                      <div className={styles["task-progress-3"]} />
                    </div>
                  </div>
                  <div className={styles["to-do-column"]}>
                    <div className={styles["to-do"]}>
                      <div className={styles["p-33"]}>
                        <span className={styles["span-22"]}>{slots[15] ?? "Done"}</span>
                      </div>
                    </div>
                    <div className={styles["task-card-to-do"]}>
                      <div className={styles["project-brief-2"]}>
                        <div className={styles["p-34"]}>
                          <span className={styles["span-23"]}>{slots[16] ?? "Plan sprint"}</span>
                        </div>
                      </div>
                      <div className={styles["task-details"]}>
                        <div className={styles["normal-4"]}>
                          <div className={styles["normal-2"]}>
                            <div className={styles["p-39"]}>
                              <span className={styles["span-26"]}>{slots[17] ?? "Normal"}</span>
                            </div>
                          </div>
                        </div>
                        <div className={styles["team-member-pm"]}>
                          <div className={styles["pm"]}>
                            <div className={styles["p-16"]}>
                              <span className={styles["span-10"]}>{slots[18] ?? "PM"}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className={styles["secondary-task-card"]}>
                      <div className={styles["assign-owners"]}>
                        <div className={styles["p-36"]}>
                          <span className={styles["span-24"]}>{slots[19] ?? "Share handoff"}</span>
                        </div>
                      </div>
                      <div className={styles["task-progress-4"]} />
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles["project-view-selector"]}>
                <div className={styles["list-view"]}>
                  <div className={styles["list"]}>
                    <div className={styles["p-40"]}>
                      <span className={styles["span-27"]}>{slots[20] ?? "List"}</span>
                    </div>
                  </div>
                </div>
                <div className={styles["board-view"]}>
                  <div className={styles["list"]}>
                    <div className={styles["p-41"]}>
                      <span className={styles["span-28"]}>{slots[21] ?? "Board"}</span>
                    </div>
                  </div>
                </div>
                <div className={styles["list-view"]}>
                  <div className={styles["list"]}>
                    <div className={styles["p-40"]}>
                      <span className={styles["span-27"]}>{slots[22] ?? "Timeline"}</span>
                    </div>
                  </div>
                </div>
                <div className={styles["list-view"]}>
                  <div className={styles["list"]}>
                    <div className={styles["p-40"]}>
                      <span className={styles["span-27"]}>{slots[23] ?? "Calendar"}</span>
                    </div>
                  </div>
                </div>
                <div className={styles["list-view"]}>
                  <div className={styles["list"]}>
                    <div className={styles["p-40"]}>
                      <span className={styles["span-27"]}>{slots[24] ?? "Sprint"}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles["timeline-view"]}>
                <div className={styles["project-timeline"]}>
                  <div className={styles["p-42"]}>
                    <span className={styles["span-29"]}>{slots[25] ?? "Project timeline"}</span>
                  </div>
                </div>
                <div className={styles["timeline-weeks"]}>
                  <div className={styles["w1"]}>
                    <div className={styles["p-43"]}>
                      <span className={styles["span-30"]}>{slots[26] ?? "W1"}</span>
                    </div>
                  </div>
                  <div className={styles["w2"]}>
                    <div className={styles["p-44"]}>
                      <span className={styles["span-30"]}>{slots[27] ?? "W2"}</span>
                    </div>
                  </div>
                  <div className={styles["w1"]}>
                    <div className={styles["p-43"]}>
                      <span className={styles["span-30"]}>{slots[28] ?? "W3"}</span>
                    </div>
                  </div>
                  <div className={styles["w2"]}>
                    <div className={styles["p-44"]}>
                      <span className={styles["span-30"]}>{slots[29] ?? "W4"}</span>
                    </div>
                  </div>
                </div>
                <div className={styles["timeline-lanes"]}>
                  <div className={styles["planning-phase"]} />
                  <div className={styles["delivery-phase"]} />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className={styles["content-2"]}>
          <div className={styles["div-20"]}>
            <h4 className={styles["h4"]}>{slots[30] ?? "Flexible Project Views"}</h4>
          </div>
          <div className={styles["div-22"]}>
            <p className={styles["p-45"]}>{slots[31] ?? "Switch between List, Kanban Board, Timeline, Calendar, and Sprint views to manage work the way your team prefers."}</p>
          </div>
        </div>
      </div>
  )
}
