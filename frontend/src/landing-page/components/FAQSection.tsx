import styles from "../styles/styles.module.css"
import States from "./States"

export default function FAQSection({ slots = [] }: { slots?: string[] }) {
  return (
      <div className={styles["desktop-6"]}>
        <div className={styles["div-43"]}>
          <div className={styles["div-5"]} />
        </div>
        <div className={styles["div-44"]}>
          <States
            a={<>
              <div className={styles["open"]}>
                <div className={styles["question"]}>
                  <div className={styles["div-45"]}>
                    <h6 className={styles["h6"]}>{"What is TaskFlow?"}</h6>
                  </div>
                  <div className={styles["plus"]}>
                    <div className={styles["div-46"]} />
                    <div className={styles["div-47"]} />
                  </div>
                </div>
                <div className={styles["line"]} />
                <div className={styles["answer"]}>
                  <div className={styles["div-48"]}>
                    <p className={styles["p-50"]}>{"TaskFlow is a project management and team collaboration platform that helps teams manage projects, organize tasks, coordinate workflows, and track delivery from one workspace."}</p>
                  </div>
                </div>
              </div>
            </>}
            b={<>
              <div className={styles["close"]}>
                <div className={styles["question-2"]}>
                  <div className={styles["div-45"]}>
                    <h6 className={styles["h6"]}>{"What is TaskFlow?"}</h6>
                  </div>
                  <div className={styles["plus-2"]}>
                    <div className={styles["div-49"]} />
                    <div className={styles["div-50"]} />
                  </div>
                </div>
              </div>
            </>}
          />
        </div>
        <div className={styles["div-51"]}>
          <States
            a={<>
              <div className={styles["close-2"]}>
                <div className={styles["question"]}>
                  <div className={styles["div-45"]}>
                    <h6 className={styles["h6"]}>{"What project views are available in TaskFlow?"}</h6>
                  </div>
                  <div className={styles["plus"]}>
                    <div className={styles["div-52"]} />
                    <div className={styles["div-53"]} />
                  </div>
                </div>
              </div>
            </>}
            b={<>
              <div className={styles["open-2"]}>
                <div className={styles["question-3"]}>
                  <div className={styles["div-45"]}>
                    <h6 className={styles["h6"]}>{"What project views are available in TaskFlow?"}</h6>
                  </div>
                  <div className={styles["plus-2"]}>
                    <div className={styles["div-54"]} />
                    <div className={styles["div-54"]} />
                  </div>
                </div>
                <div className={styles["line-2"]} />
                <div className={styles["answer-2"]}>
                  <div className={styles["div-48"]}>
                    <p className={styles["p-50"]}>{"TaskFlow supports List, Kanban Board, Timeline, Calendar, Sprint, and Project Overview views to help teams organize and monitor their work."}</p>
                  </div>
                </div>
              </div>
            </>}
          />
        </div>
        <div className={styles["div-51"]}>
          <States
            a={<>
              <div className={styles["close-2"]}>
                <div className={styles["question"]}>
                  <div className={styles["div-45"]}>
                    <h6 className={styles["h6"]}>{"Can teams customize their workflows?"}</h6>
                  </div>
                  <div className={styles["plus"]}>
                    <div className={styles["div-52"]} />
                    <div className={styles["div-53"]} />
                  </div>
                </div>
              </div>
            </>}
            b={<>
              <div className={styles["open-3"]}>
                <div className={styles["question-4"]}>
                  <div className={styles["div-45"]}>
                    <h6 className={styles["h6"]}>{"Can teams customize their workflows?"}</h6>
                  </div>
                  <div className={styles["plus-2"]}>
                    <div className={styles["div-54"]} />
                    <div className={styles["div-54"]} />
                  </div>
                </div>
                <div className={styles["line-3"]} />
                <div className={styles["answer-3"]}>
                  <div className={styles["div-55"]}>
                    <p className={styles["p-51"]}>{"Yes. Teams can configure task statuses and workflows to suit their project processes."}</p>
                  </div>
                </div>
              </div>
            </>}
          />
        </div>
        <div className={styles["div-51"]}>
          <States
            a={<>
              <div className={styles["close-2"]}>
                <div className={styles["question"]}>
                  <div className={styles["div-45"]}>
                    <h6 className={styles["h6"]}>{"Does TaskFlow support team collaboration?"}</h6>
                  </div>
                  <div className={styles["plus"]}>
                    <div className={styles["div-52"]} />
                    <div className={styles["div-53"]} />
                  </div>
                </div>
              </div>
            </>}
            b={<>
              <div className={styles["open-2"]}>
                <div className={styles["question-3"]}>
                  <div className={styles["div-45"]}>
                    <h6 className={styles["h6"]}>{"Does TaskFlow support team collaboration?"}</h6>
                  </div>
                  <div className={styles["plus-2"]}>
                    <div className={styles["div-54"]} />
                    <div className={styles["div-54"]} />
                  </div>
                </div>
                <div className={styles["line-2"]} />
                <div className={styles["answer-2"]}>
                  <div className={styles["div-48"]}>
                    <p className={styles["p-50"]}>{"Yes. TaskFlow includes team chat and collaborative whiteboards with real-time updates to help teams work together."}</p>
                  </div>
                </div>
              </div>
            </>}
          />
        </div>
        <div className={styles["div-51"]}>
          <States
            a={<>
              <div className={styles["close-2"]}>
                <div className={styles["question"]}>
                  <div className={styles["div-45"]}>
                    <h6 className={styles["h6"]}>{"Can I manage sprints and deadlines?"}</h6>
                  </div>
                  <div className={styles["plus"]}>
                    <div className={styles["div-52"]} />
                    <div className={styles["div-53"]} />
                  </div>
                </div>
              </div>
            </>}
            b={<>
              <div className={styles["open-3"]}>
                <div className={styles["question-4"]}>
                  <div className={styles["div-45"]}>
                    <h6 className={styles["h6"]}>{"Can I manage sprints and deadlines?"}</h6>
                  </div>
                  <div className={styles["plus-2"]}>
                    <div className={styles["div-54"]} />
                    <div className={styles["div-54"]} />
                  </div>
                </div>
                <div className={styles["line-3"]} />
                <div className={styles["answer-3"]}>
                  <div className={styles["div-55"]}>
                    <p className={styles["p-51"]}>{"TaskFlow provides sprint management, deadline tracking, SLA monitoring, and escalation management."}</p>
                  </div>
                </div>
              </div>
            </>}
          />
        </div>
        <div className={styles["div-51"]}>
          <States
            a={<>
              <div className={styles["close-2"]}>
                <div className={styles["question"]}>
                  <div className={styles["div-45"]}>
                    <h6 className={styles["h6"]}>{"Can I manage multiple projects?"}</h6>
                  </div>
                  <div className={styles["plus"]}>
                    <div className={styles["div-52"]} />
                    <div className={styles["div-53"]} />
                  </div>
                </div>
              </div>
            </>}
            b={<>
              <div className={styles["open-3"]}>
                <div className={styles["question-4"]}>
                  <div className={styles["div-45"]}>
                    <h6 className={styles["h6"]}>{"Can I manage multiple projects?"}</h6>
                  </div>
                  <div className={styles["plus-2"]}>
                    <div className={styles["div-54"]} />
                    <div className={styles["div-54"]} />
                  </div>
                </div>
                <div className={styles["line-3"]} />
                <div className={styles["answer-3"]}>
                  <div className={styles["div-55"]}>
                    <p className={styles["p-51"]}>{"Yes. TaskFlow provides a centralized workspace for organizing and tracking multiple projects."}</p>
                  </div>
                </div>
              </div>
            </>}
          />
        </div>
        <div className={styles["div-51"]}>
          <States
            a={<>
              <div className={styles["close-2"]}>
                <div className={styles["question"]}>
                  <div className={styles["div-45"]}>
                    <h6 className={styles["h6"]}>{"Does TaskFlow support different user roles?"}</h6>
                  </div>
                  <div className={styles["plus"]}>
                    <div className={styles["div-52"]} />
                    <div className={styles["div-53"]} />
                  </div>
                </div>
              </div>
            </>}
            b={<>
              <div className={styles["open-4"]}>
                <div className={styles["question-4"]}>
                  <div className={styles["div-45"]}>
                    <h6 className={styles["h6"]}>{"Does TaskFlow support different user roles?"}</h6>
                  </div>
                  <div className={styles["plus-2"]}>
                    <div className={styles["div-54"]} />
                    <div className={styles["div-54"]} />
                  </div>
                </div>
                <div className={styles["line-3"]} />
                <div className={styles["answer-4"]}>
                  <div className={styles["div-48"]}>
                    <p className={styles["p-50"]}>{"Yes. TaskFlow supports organization and project-level access control with roles such as Owner, Admin, Member, and Guest."}</p>
                  </div>
                </div>
              </div>
            </>}
          />
        </div>
      </div>
  )
}
