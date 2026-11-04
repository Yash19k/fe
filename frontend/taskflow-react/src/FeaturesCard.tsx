import styles from "./styles.module.css"

export default function FeaturesCard({ slots = [] }: { slots?: string[] }) {
  return (
      <div className={styles["desktop-2"]}>
        <div className={styles["image-container"]}>
          <div className={styles["div-19"]}>
            <div className={styles["soft-illustration-backdrop"]} />
            <div className={styles["centralized-projects-infographic"]}>
              <div className={styles["connected-project-overview"]}>
                <div className={styles["workspace-heading"]}>
                  <div className={styles["project-overview"]}>
                    <div className={styles["p-15"]}>
                      <span className={styles["span-9"]}>{slots[0] ?? "Project overview"}</span>
                    </div>
                  </div>
                  <div className={styles["team-member-pm"]}>
                    <div className={styles["pm"]}>
                      <div className={styles["p-16"]}>
                        <span className={styles["span-10"]}>{slots[1] ?? "PM"}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className={styles["projects-and-progress"]}>
                  <div className={styles["my-tasks"]}>
                    <div className={styles["my-tasks-2"]}>
                      <div className={styles["p-17"]}>
                        <span className={styles["span-11"]}>{slots[2] ?? "My Tasks"}</span>
                      </div>
                    </div>
                    <div className={styles["task-project-brief"]}>
                      <div className={styles["task-status"]} />
                      <div className={styles["project-brief"]}>
                        <div className={styles["p-18"]}>
                          <span className={styles["span-12"]}>{slots[3] ?? "Project brief"}</span>
                        </div>
                      </div>
                    </div>
                    <div className={styles["task-project-brief"]}>
                      <div className={styles["task-status"]} />
                      <div className={styles["project-brief"]}>
                        <div className={styles["p-18"]}>
                          <span className={styles["span-12"]}>{slots[4] ?? "Design review"}</span>
                        </div>
                      </div>
                    </div>
                    <div className={styles["launch-checklist"]}>
                      <div className={styles["task-project-brief"]}>
                        <div className={styles["launch-checklist-2"]}>
                          <div className={styles["p-19"]}>
                            <span className={styles["span-11"]}>{slots[5] ?? "Launch checklist"}</span>
                          </div>
                        </div>
                        <div className={styles["72"]}>
                          <div className={styles["p-20"]}>
                            <span className={styles["span-13"]}>{slots[6] ?? "72%"}</span>
                          </div>
                        </div>
                      </div>
                      <div className={styles["progress-track"]}>
                        <div className={styles["completed-work"]} />
                      </div>
                    </div>
                  </div>
                  <div className={styles["project-summary"]}>
                    <div className={styles["space-below-floating-project-status"]} />
                    <div className={styles["12-18"]}>
                      <div className={styles["p-21"]}>
                        <span className={styles["span-14"]}>{slots[7] ?? "12 / 18"}</span>
                      </div>
                    </div>
                    <div className={styles["tasks-complete"]}>
                      <div className={styles["p-22"]}>
                        <span className={styles["span-15"]}>{slots[8] ?? "tasks complete"}</span>
                      </div>
                    </div>
                    <div className={styles["project-progress-chart"]}>
                      <div className={styles["progress-bar-1"]} />
                      <div className={styles["progress-bar-2"]} />
                      <div className={styles["progress-bar-3"]} />
                      <div className={styles["progress-bar-4"]} />
                      <div className={styles["progress-bar-5"]} />
                      <div className={styles["progress-bar-6"]} />
                      <div className={styles["progress-bar-7"]} />
                    </div>
                  </div>
                </div>
                <div className={styles["project-team"]}>
                  <div className={styles["team-member-jd"]}>
                    <div className={styles["jd"]}>
                      <div className={styles["p-23"]}>
                        <span className={styles["span-16"]}>{slots[9] ?? "JD"}</span>
                      </div>
                    </div>
                  </div>
                  <div className={styles["team-member-al"]}>
                    <div className={styles["al"]}>
                      <div className={styles["p-24"]}>
                        <span className={styles["span-17"]}>{slots[10] ?? "AL"}</span>
                      </div>
                    </div>
                  </div>
                  <div className={styles["team-member-mk"]}>
                    <div className={styles["mk"]}>
                      <div className={styles["p-25"]}>
                        <span className={styles["span-18"]}>{slots[11] ?? "MK"}</span>
                      </div>
                    </div>
                  </div>
                  <div className={styles["product-team"]}>
                    <div className={styles["p-26"]}>
                      <span className={styles["span-15"]}>{slots[12] ?? "Product team"}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles["active-project-card"]}>
                <div className={styles["website-launch"]}>
                  <div className={styles["p-27"]}>
                    <span className={styles["span-19"]}>{slots[13] ?? "Website launch"}</span>
                  </div>
                </div>
                <div className={styles["in-progress"]}>
                  <div className={styles["in-progress-2"]}>
                    <div className={styles["p-28"]}>
                      <span className={styles["span-20"]}>{slots[14] ?? "In progress"}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles["upcoming-deadlines"]}>
                <div className={styles["upcoming-deadline"]}>
                  <div className={styles["p-29"]}>
                    <span className={styles["span-15"]}>{slots[15] ?? "Upcoming deadline"}</span>
                  </div>
                </div>
                <div className={styles["design-review"]}>
                  <div className={styles["p-30"]}>
                    <span className={styles["span-19"]}>{slots[16] ?? "Design review"}</span>
                  </div>
                </div>
                <div className={styles["review-deadline"]}>
                  <div className={styles["tomorrow"]}>
                    <div className={styles["tomorrow-2"]}>
                      <div className={styles["p-31"]}>
                        <span className={styles["span-21"]}>{slots[17] ?? "Tomorrow"}</span>
                      </div>
                    </div>
                  </div>
                  <div className={styles["team-member-al"]}>
                    <div className={styles["al"]}>
                      <div className={styles["p-24"]}>
                        <span className={styles["span-17"]}>{slots[18] ?? "AL"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className={styles["content"]}>
          <div className={styles["div-20"]}>
            <h4 className={styles["h4"]}>{slots[19] ?? "Centralized Project Management"}</h4>
          </div>
          <div className={styles["div-21"]}>
            <p className={styles["p-32"]}>{slots[20] ?? "Manage projects, tasks, priorities, assignees, deadlines, and progress from one organized workspace."}</p>
          </div>
        </div>
      </div>
  )
}
