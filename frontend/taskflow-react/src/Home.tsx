import styles from "./styles.module.css"
import RevealWatcher from "./RevealWatcher"
import { SvgGraphic } from "./RichText"
import TaskFlowNavigation from "./TaskFlowNavigation"
import Button from "./Button"
import RollingText from "./RollingText"
import SmoothScroll from "./SmoothScroll"
import LogoFloating from "./LogoFloating"
import LogoFloating2 from "./LogoFloating2"
import Button2 from "./Button2"
import RollingText2 from "./RollingText2"
import ClientLogoTicker from "./ClientLogoTicker"
import FolderKanban from "./FolderKanban"
import ClipboardList from "./ClipboardList"
import MessageCircle from "./MessageCircle"
import Presentation from "./Presentation"
import Seperator from "./Seperator"
import FeaturesCard from "./FeaturesCard"
import FeaturesCard2 from "./FeaturesCard2"
import BenefitCard from "./BenefitCard"
import BenefitCard2 from "./BenefitCard2"
import TickerPath from "./TickerPath"
import FAQSection from "./FAQSection"
import LayoutJumpPreventer from "./LayoutJumpPreventer"
import FAQAccordion from "./FAQAccordion"
import TaskFlowProFooter from "./TaskFlowProFooter"
import Github from "./Github"
import Linkedin from "./Linkedin"
import TaskFlowPageLayout2 from "./TaskFlowPageLayout2"

export default function Home({ slots = [] }: { slots?: string[] }) {
  return (
    <>
      <RevealWatcher />
      <div className={styles["div-61"]}>
        <div className={styles["div-62"]}>
          <div className={styles["taskflow-navigation"]}>
            <div className={styles["div-63"]}>
              <TaskFlowNavigation slots={["TaskFlow","Features","Benefits","How It Works","Integrations","FAQ","Resources","Get Started","G","e","t","S","t","a","r","t","e","d"]} />
            </div>
          </div>
          <div className={styles["div-64"]}>
            <div className={styles["div-65"]}>
              <SmoothScroll slots={[]} />
            </div>
            <main className={styles["main"]}>
              <section className={styles["hero"]}>
                <div className={styles["hero-dot-grid-radial-fade"]}>
                  <div className={styles["div-66"]}>
                    <div className={styles["div-67"]} />
                    <div className={styles["canvas"]} />
                  </div>
                </div>
                <div className={styles["container"]}>
                  <div className={styles["wrapper"]}>
                    <div className={styles["div-68"]}>
                      <LogoFloating slots={["https://framerusercontent.com/images/F41yn7x91OCcRjAPP1ZGlqlqwGM.png?width=1254&height=1254"]} />
                    </div>
                  </div>
                  <div className={styles["wrapper-2"]}>
                    <div className={styles["div-69"]}>
                      <LogoFloating2 slots={["https://framerusercontent.com/images/kl9iyzbjdfDhAtxyRmTXKP2O3g.png?width=1254&height=1254"]} />
                    </div>
                  </div>
                  <div className={styles["wrapper-3"]}>
                    <div className={styles["div-70"]}>
                      <LogoFloating slots={["https://framerusercontent.com/images/B0eWJz2S22yDevWhgKdRpTiHK58.png?width=1254&height=1254"]} />
                    </div>
                  </div>
                  <div className={styles["wrapper-4"]}>
                    <div className={styles["div-71"]}>
                      <LogoFloating2 slots={["https://framerusercontent.com/images/O7bbpOwntl6cEUN0Gd1EtlmbsU.png?width=1254&height=1254"]} />
                    </div>
                  </div>
                  <div className={styles["content-5"]}>
                    <div className={styles["top"]}>
                      <div className={styles["tag"]}>
                        <div className={styles["text-5"]}>
                          <p className={styles["p-64"]}>{slots[0] ?? "PROJECT MANAGEMENT, CONNECTED"}</p>
                        </div>
                      </div>
                      <div className={styles["text-container-2"]}>
                        <div className={styles["div-63"]}>
                          <div className={styles["heading-4"]}>
                            <h1 className={styles["h1"]}>{slots[1] ?? "Bring every project, task, and conversation into one workspace."}</h1>
                          </div>
                        </div>
                        <div className={styles["div-22"]}>
                          <p className={styles["p-65"]}>{slots[2] ?? "Plan projects, organize tasks, collaborate with your team, and track progress with TaskFlow. Everything your team needs to move work forward, all in one place."}</p>
                        </div>
                      </div>
                    </div>
                    <div className={styles["bottom"]}>
                      <div className={styles["hero-actions"]}>
                        <div className={styles["div-63"]}>
                          <div className={styles["get-started-configure-signup-url"]}>
                            <Button slots={["Get Started","G","e","t","S","t","a","r","t","e","d"]} />
                          </div>
                        </div>
                        <div className={styles["div-63"]}>
                          <div className={styles["explore-features-3"]}>
                            <Button2 slots={["Explore Features","E","x","p","l","o","r","e","F","e","a","t","u","r","e","s"]} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={styles["dashboard"]}>
                    <div className={styles["container-2"]}>
                      <div className={styles["img-container"]}>
                        <div className={styles["div-63"]}>
                          <div className={styles["div-72"]}>
                            <div className={styles["div-73"]}>
                              <img className={styles["img-3"]} src={slots[3] ?? "https://framerusercontent.com/images/UFpdSyB8VshkRbCvRIBOPuq6Y.png?width=1555&height=1011"} alt="" />
                            </div>
                            <div className={styles["taskflow-logo-preview-branding"]}>
                              <div className={styles["div-74"]}>
                                <SvgGraphic className={styles["svg-10"]} html={"<svg style=\"width:100%;height:100%;\" viewBox=\"0 0 1555 1011\" preserveAspectRatio=\"none\" width=\"100%\" height=\"100%\" data-f2c-idx=\"165\"><use href=\"#svg1269902988_571\" data-f2c-idx=\"166\"></use></svg>"} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={styles["logos"]}>
                    <div className={styles["container-3"]}>
                      <div className={styles["heading-5"]}>
                        <h5 className={styles["h5-3"]}>{slots[4] ?? "One workspace. Every project. Your whole team."}</h5>
                      </div>
                      <div className={styles["logos-2"]}>
                        <div className={styles["client-logos"]}>
                          <div className={styles["div-63"]}>
                            <div className={styles["div-75"]}>
                              <ClientLogoTicker slots={[]} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
              <section className={styles["features-4"]}>
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
              <section className={styles["benefits-2"]}>
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
              <section className={styles["how-it-works-2"]}>
                <div className={styles["container-6"]}>
                  <div className={styles["div-63"]}>
                    <div className={styles["div-76"]}>
                      <Seperator slots={["HOW TASKFLOW WORKS","From planning to completion, all in three steps.","Organize your work, bring your team together, and track progress through every stage of delivery."]} />
                    </div>
                  </div>
                  <div className={styles["cards-3"]}>
                    <div className={styles["top-4"]}>
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
                                      <div className={styles["progress-bar-5-3"]} />
                                      <div className={styles["progress-bar-6-3"]} />
                                      <div className={styles["progress-bar-7-3"]} />
                                    </div>
                                  </div>
                                </div>
                                <div className={styles["project-team-2"]}>
                                  <div className={styles["team-member-jd-3"]}>
                                    <div className={styles["jd"]}>
                                      <div className={styles["p-23"]}>
                                        <span className={styles["span-16"]}>{slots[51] ?? "JD"}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className={styles["team-member-al-3"]}>
                                    <div className={styles["al"]}>
                                      <div className={styles["p-24"]}>
                                        <span className={styles["span-17"]}>{slots[52] ?? "AL"}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className={styles["team-member-mk-3"]}>
                                    <div className={styles["mk"]}>
                                      <div className={styles["p-25"]}>
                                        <span className={styles["span-18"]}>{slots[53] ?? "MK"}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className={styles["product-team-2"]}>
                                    <div className={styles["p-96"]}>
                                      <span className={styles["span-15"]}>{slots[54] ?? "Product team"}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className={styles["upcoming-deadlines-2"]}>
                                <div className={styles["upcoming-deadline-2"]}>
                                  <div className={styles["p-97"]}>
                                    <span className={styles["span-15"]}>{slots[55] ?? "Upcoming deadline"}</span>
                                  </div>
                                </div>
                                <div className={styles["design-review-2"]}>
                                  <div className={styles["p-98"]}>
                                    <span className={styles["span-55"]}>{slots[56] ?? "Design review"}</span>
                                  </div>
                                </div>
                                <div className={styles["review-deadline-2"]}>
                                  <div className={styles["tomorrow-3"]}>
                                    <div className={styles["tomorrow-2"]}>
                                      <div className={styles["p-31"]}>
                                        <span className={styles["span-21"]}>{slots[57] ?? "Tomorrow"}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className={styles["team-member-al-3"]}>
                                    <div className={styles["al"]}>
                                      <div className={styles["p-24"]}>
                                        <span className={styles["span-17"]}>{slots[58] ?? "AL"}</span>
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
                            <h4 className={styles["h4-2"]}>{slots[59] ?? "Organize Your Workspace"}</h4>
                          </div>
                          <div className={styles["description"]}>
                            <p className={styles["p-99"]}>{slots[60] ?? "Create projects, add tasks, assign responsibilities, and configure workflows that suit your team."}</p>
                          </div>
                        </div>
                      </div>
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
              <section className={styles["integrations-2"]}>
                <div className={styles["container-7"]}>
                  <div className={styles["integration"] + " " + styles["rv-3"]} data-reveal>
                    <div className={styles["div-84"]}>
                      <TickerPath slots={[]} />
                    </div>
                    <div className={styles["wrapper-5"]}>
                      <div className={styles["content-7"]}>
                        <div className={styles["div-63"]}>
                          <div className={styles["div-85"]}>
                            <div className={styles["01-3"]}>
                              <div className={styles["text-7"]}>
                                <p className={styles["p-119"]}>{slots[89] ?? "ONE CONNECTED WORKSPACE"}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className={styles["heading-text"]}>
                          <div className={styles["heading-8"]}>
                            <h2 className={styles["h2-3"]}>{slots[90] ?? "Everything your team needs, working together."}</h2>
                          </div>
                          <div className={styles["text-8"]}>
                            <p className={styles["p-120"]}>{slots[91] ?? "Bring project planning, task management, conversations, collaborative whiteboards, and delivery tracking into one connected workspace."}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
              <section className={styles["faq-2"]}>
                <div className={styles["container-8"]}>
                  <div className={styles["div-63"]}>
                    <div className={styles["div-76"]}>
                      <Seperator slots={["FREQUENTLY ASKED QUESTIONS","Everything you need to know about TaskFlow.","Learn how TaskFlow helps teams organize projects, manage work, and collaborate more effectively."]} />
                    </div>
                  </div>
                  <div className={styles["div-63"]}>
                    <div className={styles["div-86"] + " " + styles["rv-3"]} data-reveal style={{ transitionDelay: "85ms" }}>
                      <FAQSection slots={["What is TaskFlow?","TaskFlow is a project management and team collaboration platform that helps teams manage projects, organize tasks, coordinate workflows, and track delivery from one workspace.","What project views are available in TaskFlow?","Can teams customize their workflows?","Does TaskFlow support team collaboration?","Can I manage sprints and deadlines?","Can I manage multiple projects?","Does TaskFlow support different user roles?"]} />
                    </div>
                  </div>
                </div>
              </section>
              <section className={styles["newsletter"]}>
                <div className={styles["container-9"]}>
                  <div className={styles["newsletter-2"] + " " + styles["rv-3"]} data-reveal style={{ transitionDelay: "215ms" }}>
                    <div className={styles["image"]}>
                      <div className={styles["div-87"]}>
                        <img className={styles["img-4"]} src={slots[92] ?? "https://framerusercontent.com/images/OmGZB6Q2bVw2OL3RXRH55t39LWg.png?scale-down-to=512&width=558&height=386"} alt="" />
                      </div>
                    </div>
                    <div className={styles["image-2"]}>
                      <div className={styles["div-87"]}>
                        <img className={styles["img-4"]} src={slots[93] ?? "https://framerusercontent.com/images/OmGZB6Q2bVw2OL3RXRH55t39LWg.png?scale-down-to=512&width=558&height=386"} alt="" />
                      </div>
                    </div>
                    <div className={styles["image-container-4"] + " " + styles["rv-12"]} data-reveal>
                      <div className={styles["image-3"]}>
                        <div className={styles["div-88"]}>
                          <img className={styles["img-5"]} src={slots[94] ?? "https://framerusercontent.com/images/OXyYHX9MW2fCN7IDYfVvNCAqUX0.png?scale-down-to=512&width=4167&height=2861"} alt="" />
                        </div>
                      </div>
                    </div>
                    <div className={styles["image-container-5"] + " " + styles["rv-13"]} data-reveal>
                      <div className={styles["image-4"]}>
                        <div className={styles["div-89"]}>
                          <img className={styles["img-6"]} src={slots[95] ?? "https://framerusercontent.com/images/OXyYHX9MW2fCN7IDYfVvNCAqUX0.png?scale-down-to=512&width=4167&height=2861"} alt="" />
                        </div>
                      </div>
                    </div>
                    <div className={styles["content-8"]}>
                      <div className={styles["heading-text-2"]}>
                        <div className={styles["heading-9"] + " " + styles["rv-3"]} data-reveal style={{ transitionDelay: "108ms" }}>
                          <h2 className={styles["h2-4"]}>{slots[96] ?? "Stay connected with TaskFlow."}</h2>
                        </div>
                        <div className={styles["text-9"] + " " + styles["rv-11"]} data-reveal style={{ transitionDelay: "215ms" }}>
                          <p className={styles["p-121"]}>{slots[97] ?? "Get product updates, project management insights, and practical ideas to help your team work better."}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </main>
          </div>
          <div className={styles["div-5"]} />
          <div className={styles["div-90"]} />
          <div className={styles["taskflow-pro-footer"]}>
            <div className={styles["div-63"]}>
              <TaskFlowProFooter slots={["Ready to bring your team’s work together?","Plan projects, manage tasks, collaborate with your team, and keep every project moving forward with TaskFlow Pro.","Get Started →","G","e","t","S","t","a","r","t","e","d","→","Explore Features","TaskFlow","One connected workspace for projects, tasks, sprints, and team collaboration.","Product","Features","Project Management","Task Management","Board View","Timeline","Sprint Planning","Collaboration","Resources","How It Works","Frequently Asked Questions","Contact","Get Started","Sign In","Create Account","Get Started","© 2026 TaskFlow Pro. All rights reserved.","Privacy Policy","Terms of Service"]} />
            </div>
          </div>
        </div>
        <TaskFlowPageLayout2 slots={[]} />
      </div>
      <div className={styles["div-91"]}>
        <SvgGraphic className={styles["svg-11"]} html={"<svg width=\"84\" height=\"64\" viewBox=\"0 0 84 64\" role=\"img\" aria-label=\"TaskFlow Pro flowing TF symbol\" id=\"svg-348115219_472\" data-f2c-idx=\"1578\"><title data-f2c-idx=\"1579\" style=\"font-family:sans-serif;font-size:12px;font-weight:400;color:rgb(0, 0, 0);text-align:start;\">My Framer Site</title><path fill=\"#126DFB\" d=\"M4 20C6 11 12 6 23 6H55L51 18H33L25 46C23 55 17 60 8 60L20 20Z\" data-f2c-idx=\"1580\"></path><path fill=\"#24BDD9\" d=\"M48 6H80C78 15 73 20 65 20H54L51 31H70C68 39 63 44 55 44H47L43 60H30L41 22C43 14 48 9 56 6Z\" data-f2c-idx=\"1581\"></path><path fill=\"#3848C9\" d=\"M48 6H56C54 15 49 20 40 20L42 14C43 10 45 8 48 6Z\" data-f2c-idx=\"1582\"></path></svg>"} />
        <SvgGraphic className={styles["svg-12"]} html={"<svg aria-hidden=\"true\" pointer-events=\"none\" width=\"1555\" height=\"1011\" viewBox=\"0 0 1555 1011\" preserveAspectRatio=\"xMidYMid slice\" id=\"svg1269902988_571\" data-f2c-idx=\"1583\"><rect x=\"15\" y=\"13\" width=\"48\" height=\"47\" rx=\"7\" fill=\"#F5F9FE\" data-f2c-idx=\"1584\"></rect><g transform=\"translate(15 17) scale(.56)\" data-f2c-idx=\"1585\"><path fill=\"#126DFB\" d=\"M4 20C6 11 12 6 23 6H55L51 18H33L25 46C23 55 17 60 8 60L20 20Z\" data-f2c-idx=\"1586\"></path><path fill=\"#24BDD9\" d=\"M48 6H80C78 15 73 20 65 20H54L51 31H70C68 39 63 44 55 44H47L43 60H30L41 22C43 14 48 9 56 6Z\" data-f2c-idx=\"1587\"></path><path fill=\"#3848C9\" d=\"M48 6H56C54 15 49 20 40 20L42 14C43 10 45 8 48 6Z\" data-f2c-idx=\"1588\"></path></g></svg>"} />
        <SvgGraphic className={styles["svg-13"]} html={"<svg width=\"150\" height=\"35\" viewBox=\"0 0 150 35\" id=\"svg1006247321_211\" data-f2c-idx=\"1589\"><text x=\"28\" y=\"24\" font-family=\"Inter,Arial,sans-serif\" font-size=\"18\" font-weight=\"600\" fill=\"#15171a\" data-f2c-idx=\"1590\" style=\"font-family:Inter, Arial, sans-serif;font-size:18px;font-weight:600;color:rgb(0, 0, 0);text-align:start;\">Projects</text></svg>"} />
        <SvgGraphic className={styles["svg-13"]} html={"<svg width=\"150\" height=\"35\" viewBox=\"0 0 150 35\" id=\"svg392938037_208\" data-f2c-idx=\"1591\"><text x=\"28\" y=\"24\" font-family=\"Inter,Arial,sans-serif\" font-size=\"18\" font-weight=\"600\" fill=\"#15171a\" data-f2c-idx=\"1592\" style=\"font-family:Inter, Arial, sans-serif;font-size:18px;font-weight:600;color:rgb(0, 0, 0);text-align:start;\">Tasks</text></svg>"} />
        <SvgGraphic className={styles["svg-13"]} html={"<svg width=\"150\" height=\"35\" viewBox=\"0 0 150 35\" id=\"svg1140465544_212\" data-f2c-idx=\"1593\"><text x=\"28\" y=\"24\" font-family=\"Inter,Arial,sans-serif\" font-size=\"18\" font-weight=\"600\" fill=\"#15171a\" data-f2c-idx=\"1594\" style=\"font-family:Inter, Arial, sans-serif;font-size:18px;font-weight:600;color:rgb(0, 0, 0);text-align:start;\">Team Chat</text></svg>"} />
        <SvgGraphic className={styles["svg-13"]} html={"<svg width=\"150\" height=\"35\" viewBox=\"0 0 150 35\" id=\"svg-933826410_213\" data-f2c-idx=\"1595\"><text x=\"28\" y=\"24\" font-family=\"Inter,Arial,sans-serif\" font-size=\"18\" font-weight=\"600\" fill=\"#15171a\" data-f2c-idx=\"1596\" style=\"font-family:Inter, Arial, sans-serif;font-size:18px;font-weight:600;color:rgb(0, 0, 0);text-align:start;\">Whiteboard</text></svg>"} />
        <SvgGraphic className={styles["svg-13"]} html={"<svg width=\"150\" height=\"35\" viewBox=\"0 0 150 35\" id=\"svg978027277_274\" data-f2c-idx=\"1597\"><rect x=\"2\" y=\"8\" width=\"18\" height=\"18\" rx=\"5\" fill=\"#126dfb\" data-f2c-idx=\"1598\"></rect><text x=\"28\" y=\"24\" font-family=\"Inter,Arial,sans-serif\" font-size=\"18\" font-weight=\"600\" fill=\"#15171a\" data-f2c-idx=\"1599\" style=\"font-family:Inter, Arial, sans-serif;font-size:18px;font-weight:600;color:rgb(0, 0, 0);text-align:start;\">Sprints</text></svg>"} />
        <SvgGraphic className={styles["svg-13"]} html={"<svg width=\"150\" height=\"35\" viewBox=\"0 0 150 35\" id=\"svg-2091048129_279\" data-f2c-idx=\"1600\"><rect x=\"2\" y=\"8\" width=\"18\" height=\"18\" rx=\"5\" fill=\"#126dfb\" data-f2c-idx=\"1601\"></rect><text x=\"28\" y=\"24\" font-family=\"Inter,Arial,sans-serif\" font-size=\"16\" font-weight=\"600\" fill=\"#15171a\" data-f2c-idx=\"1602\" style=\"font-family:Inter, Arial, sans-serif;font-size:16px;font-weight:600;color:rgb(0, 0, 0);text-align:start;\">SLA Tracking</text></svg>"} />
        <SvgGraphic className={styles["svg-14"]} html={"<svg width=\"32\" height=\"32\" viewBox=\"0 0 32 32\" id=\"svg1913215000_680\" data-f2c-idx=\"1603\">\n<circle cx=\"12\" cy=\"17\" r=\"9\" fill=\"#8B5CF6\" opacity=\".15\" data-f2c-idx=\"1604\"></circle>\n<path d=\"M4 26v-2a7 7 0 0 1 14 0v2\" fill=\"#8B5CF6\" opacity=\".55\" data-f2c-idx=\"1605\"></path>\n<circle cx=\"11\" cy=\"14\" r=\"4\" fill=\"#8B5CF6\" data-f2c-idx=\"1606\"></circle>\n<path d=\"M13 27v-2a7 7 0 0 1 14 0v2\" fill=\"#F472B6\" stroke=\"#F2EBFF\" stroke-width=\"1.5\" data-f2c-idx=\"1607\"></path>\n<circle cx=\"20\" cy=\"15\" r=\"4\" fill=\"#F472B6\" stroke=\"#F2EBFF\" stroke-width=\"1.5\" data-f2c-idx=\"1608\"></circle>\n<path d=\"M19 3h9a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-3l-4 3v-3h-2a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z\" fill=\"white\" stroke=\"#8B5CF6\" stroke-width=\"1.4\" data-f2c-idx=\"1609\"></path>\n<circle cx=\"21\" cy=\"7.5\" r=\".8\" fill=\"#8B5CF6\" data-f2c-idx=\"1610\"></circle><circle cx=\"25.5\" cy=\"7.5\" r=\".8\" fill=\"#F472B6\" data-f2c-idx=\"1611\"></circle></svg>"} />
        <SvgGraphic className={styles["svg-14"]} html={"<svg width=\"32\" height=\"32\" viewBox=\"0 0 32 32\" id=\"svg-505428859_670\" data-f2c-idx=\"1612\">\n<rect x=\"3\" y=\"3\" width=\"22\" height=\"21\" rx=\"3\" fill=\"#06B6D4\" opacity=\".2\" data-f2c-idx=\"1613\"></rect>\n<rect x=\"7\" y=\"7\" width=\"22\" height=\"22\" rx=\"3\" fill=\"white\" stroke=\"#3B82F6\" stroke-width=\"1.5\" data-f2c-idx=\"1614\"></rect>\n<path d=\"M7.5 13h21\" stroke=\"#3B82F6\" stroke-width=\"1.5\" data-f2c-idx=\"1615\"></path>\n<circle cx=\"11\" cy=\"10\" r=\".8\" fill=\"#3B82F6\" data-f2c-idx=\"1616\"></circle><circle cx=\"14\" cy=\"10\" r=\".8\" fill=\"#06B6D4\" data-f2c-idx=\"1617\"></circle>\n<rect x=\"10\" y=\"16\" width=\"6\" height=\"9\" rx=\"1.5\" fill=\"#3B82F6\" opacity=\".75\" data-f2c-idx=\"1618\"></rect>\n<rect x=\"18\" y=\"16\" width=\"8\" height=\"4\" rx=\"1.3\" fill=\"#06B6D4\" data-f2c-idx=\"1619\"></rect>\n<path d=\"M19 23h6M19 26h4\" stroke=\"#3B82F6\" opacity=\".45\" stroke-width=\"1.5\" stroke-linecap=\"round\" data-f2c-idx=\"1620\"></path></svg>"} />
        <SvgGraphic className={styles["svg-14"]} html={"<svg width=\"32\" height=\"32\" viewBox=\"0 0 32 32\" id=\"svg1191453966_717\" data-f2c-idx=\"1621\">\n<path d=\"M16 10v6M7 22v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4\" fill=\"none\" stroke=\"#14B8A6\" stroke-width=\"1.7\" stroke-linecap=\"round\" data-f2c-idx=\"1622\"></path>\n<rect x=\"10\" y=\"2\" width=\"12\" height=\"9\" rx=\"2.5\" fill=\"#14B8A6\" data-f2c-idx=\"1623\"></rect>\n<path d=\"M13.5 6.5h5\" stroke=\"white\" stroke-width=\"1.5\" stroke-linecap=\"round\" data-f2c-idx=\"1624\"></path>\n<rect x=\"1\" y=\"21\" width=\"12\" height=\"9\" rx=\"2.5\" fill=\"white\" stroke=\"#14B8A6\" stroke-width=\"1.5\" data-f2c-idx=\"1625\"></rect>\n<rect x=\"19\" y=\"21\" width=\"12\" height=\"9\" rx=\"2.5\" fill=\"#22C55E\" data-f2c-idx=\"1626\"></rect>\n<circle cx=\"7\" cy=\"25.5\" r=\"1.5\" fill=\"#14B8A6\" data-f2c-idx=\"1627\"></circle>\n<path d=\"m22.5 25.5 1.5 1.5 3-3\" fill=\"none\" stroke=\"white\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" data-f2c-idx=\"1628\"></path></svg>"} />
        <SvgGraphic className={styles["svg-14"]} html={"<svg width=\"32\" height=\"32\" viewBox=\"0 0 32 32\" id=\"svg-131389556_475\" data-f2c-idx=\"1629\">\n<circle cx=\"14\" cy=\"15\" r=\"12\" fill=\"#F97360\" opacity=\".13\" data-f2c-idx=\"1630\"></circle>\n<circle cx=\"13\" cy=\"11\" r=\"5\" fill=\"#F97360\" data-f2c-idx=\"1631\"></circle>\n<path d=\"M4 27v-3a9 9 0 0 1 18 0v3Z\" fill=\"#F97360\" opacity=\".75\" data-f2c-idx=\"1632\"></path>\n<circle cx=\"24\" cy=\"23\" r=\"7\" fill=\"#F59E0B\" stroke=\"#FFF0E9\" stroke-width=\"2\" data-f2c-idx=\"1633\"></circle>\n<path d=\"m20.5 23 2.2 2.2 4-4.2\" fill=\"none\" stroke=\"white\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" data-f2c-idx=\"1634\"></path></svg>"} />
        <SvgGraphic className={styles["svg-14"]} html={"<svg width=\"32\" height=\"32\" viewBox=\"0 0 32 32\" id=\"svg-1225756127_559\" data-f2c-idx=\"1635\">\n<path d=\"M3 3v25a1 1 0 0 0 1 1h25\" fill=\"none\" stroke=\"#6366F1\" opacity=\".3\" stroke-width=\"1.4\" stroke-linecap=\"round\" data-f2c-idx=\"1636\"></path>\n<rect x=\"7\" y=\"19\" width=\"5\" height=\"7\" rx=\"1.5\" fill=\"#A78BFA\" data-f2c-idx=\"1637\"></rect>\n<rect x=\"15\" y=\"14\" width=\"5\" height=\"12\" rx=\"1.5\" fill=\"#6366F1\" opacity=\".65\" data-f2c-idx=\"1638\"></rect>\n<rect x=\"23\" y=\"8\" width=\"5\" height=\"18\" rx=\"1.5\" fill=\"#6366F1\" data-f2c-idx=\"1639\"></rect>\n<path d=\"m7 14 8-6 5 2 8-7M23 3h5v5\" fill=\"none\" stroke=\"#A78BFA\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" data-f2c-idx=\"1640\"></path></svg>"} />
        <SvgGraphic className={styles["svg-14"]} html={"<svg width=\"32\" height=\"32\" viewBox=\"0 0 32 32\" id=\"svg-1087771581_789\" data-f2c-idx=\"1641\">\n<rect x=\"3\" y=\"5\" width=\"23\" height=\"24\" rx=\"3\" fill=\"white\" stroke=\"#F59E0B\" stroke-width=\"1.5\" data-f2c-idx=\"1642\"></rect>\n<path d=\"M3.5 12h22\" stroke=\"#F59E0B\" stroke-width=\"1.5\" data-f2c-idx=\"1643\"></path>\n<path d=\"M9 2v6M20 2v6\" stroke=\"#F59E0B\" stroke-width=\"2\" stroke-linecap=\"round\" data-f2c-idx=\"1644\"></path>\n<path d=\"m7 17 1.5 1.5 2.5-3M7 23l1.5 1.5 2.5-3\" fill=\"none\" stroke=\"#10B981\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" data-f2c-idx=\"1645\"></path>\n<path d=\"M14 17h7M14 23h4\" stroke=\"#F59E0B\" opacity=\".55\" stroke-width=\"1.5\" stroke-linecap=\"round\" data-f2c-idx=\"1646\"></path>\n<circle cx=\"25\" cy=\"25\" r=\"6\" fill=\"#10B981\" stroke=\"#FFF6E4\" stroke-width=\"1.5\" data-f2c-idx=\"1647\"></circle>\n<path d=\"m22.5 25 1.6 1.6 3-3.2\" fill=\"none\" stroke=\"white\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" data-f2c-idx=\"1648\"></path></svg>"} />
        <SvgGraphic className={styles["svg-15"]} html={"<svg width=\"64\" height=\"64\" viewBox=\"0 0 64 64\" id=\"svg-1296113021_528\" data-f2c-idx=\"1649\"><g fill=\"none\" stroke=\"#8B5CF6\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" data-f2c-idx=\"1650\"><rect x=\"14\" y=\"17\" width=\"36\" height=\"34\" rx=\"6\" fill=\"white\" data-f2c-idx=\"1651\"></rect><path d=\"M14 27h36M23 13v8m18-8v8\" data-f2c-idx=\"1652\"></path><rect x=\"20\" y=\"33\" width=\"10\" height=\"6\" rx=\"2\" fill=\"#8B5CF6\" stroke=\"none\" data-f2c-idx=\"1653\"></rect><rect x=\"34\" y=\"33\" width=\"10\" height=\"6\" rx=\"2\" fill=\"#DDD0FD\" stroke=\"none\" data-f2c-idx=\"1654\"></rect><rect x=\"20\" y=\"42\" width=\"24\" height=\"4\" rx=\"2\" fill=\"#DDD0FD\" stroke=\"none\" data-f2c-idx=\"1655\"></rect></g></svg>"} />
        <SvgGraphic className={styles["svg-15"]} html={"<svg width=\"64\" height=\"64\" viewBox=\"0 0 64 64\" id=\"svg1220250223_478\" data-f2c-idx=\"1656\"><g fill=\"none\" stroke=\"#14B8A6\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" data-f2c-idx=\"1657\"><rect x=\"16\" y=\"13\" width=\"32\" height=\"40\" rx=\"6\" fill=\"white\" data-f2c-idx=\"1658\"></rect><rect x=\"25\" y=\"10\" width=\"14\" height=\"7\" rx=\"3\" fill=\"#AFEADF\" data-f2c-idx=\"1659\"></rect><path d=\"m22 27 3 3 5-6m-8 16 3 3 5-6M35 28h7m-7 13h7\" data-f2c-idx=\"1660\"></path><circle cx=\"47\" cy=\"49\" r=\"9\" fill=\"#14B8A6\" stroke=\"white\" data-f2c-idx=\"1661\"></circle><path d=\"m43 49 3 3 5-6\" stroke=\"white\" data-f2c-idx=\"1662\"></path></g></svg>"} />
        <SvgGraphic className={styles["svg-15"]} html={"<svg width=\"64\" height=\"64\" viewBox=\"0 0 64 64\" id=\"svg483863184_442\" data-f2c-idx=\"1663\"><g fill=\"none\" stroke=\"#F97360\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" data-f2c-idx=\"1664\"><path d=\"M27 24h20a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6h-3l-7 6v-6H27a6 6 0 0 1-6-6V30a6 6 0 0 1 6-6Z\" fill=\"#FFD0C3\" data-f2c-idx=\"1665\"></path><path d=\"M17 13h22a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6H25l-9 7v-7a6 6 0 0 1-5-6V19a6 6 0 0 1 6-6Z\" fill=\"white\" data-f2c-idx=\"1666\"></path><path d=\"M19 23h18m-18 6h12\" data-f2c-idx=\"1667\"></path></g></svg>"} />
        <SvgGraphic className={styles["svg-15"]} html={"<svg width=\"64\" height=\"64\" viewBox=\"0 0 64 64\" id=\"svg217399333_524\" data-f2c-idx=\"1668\"><g fill=\"none\" stroke=\"#3B82F6\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" data-f2c-idx=\"1669\"><rect x=\"10\" y=\"14\" width=\"44\" height=\"34\" rx=\"6\" fill=\"white\" data-f2c-idx=\"1670\"></rect><path d=\"M25 48v6m14-6v6m-20 0h26M23 25l17 10m-17 5 17-5\" data-f2c-idx=\"1671\"></path><rect x=\"17\" y=\"21\" width=\"10\" height=\"9\" rx=\"3\" fill=\"#BEDAFE\" data-f2c-idx=\"1672\"></rect><rect x=\"36\" y=\"30\" width=\"11\" height=\"10\" rx=\"3\" fill=\"#3B82F6\" stroke=\"none\" data-f2c-idx=\"1673\"></rect><rect x=\"17\" y=\"36\" width=\"10\" height=\"9\" rx=\"3\" fill=\"#BEDAFE\" data-f2c-idx=\"1674\"></rect></g></svg>"} />
        <SvgGraphic className={styles["svg-15"]} html={"<svg width=\"64\" height=\"64\" viewBox=\"0 0 64 64\" id=\"svg1002055917_625\" data-f2c-idx=\"1675\"><g fill=\"none\" stroke=\"#F59E0B\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" data-f2c-idx=\"1676\"><rect x=\"12\" y=\"13\" width=\"40\" height=\"39\" rx=\"6\" fill=\"white\" data-f2c-idx=\"1677\"></rect><rect x=\"19\" y=\"36\" width=\"6\" height=\"9\" rx=\"2\" fill=\"#FDE4A7\" stroke=\"none\" data-f2c-idx=\"1678\"></rect><rect x=\"29\" y=\"29\" width=\"6\" height=\"16\" rx=\"2\" fill=\"#FDE4A7\" stroke=\"none\" data-f2c-idx=\"1679\"></rect><rect x=\"39\" y=\"22\" width=\"6\" height=\"23\" rx=\"2\" fill=\"#F59E0B\" stroke=\"none\" data-f2c-idx=\"1680\"></rect><path d=\"m19 29 10-7 7 2 9-8\" data-f2c-idx=\"1681\"></path><circle cx=\"48\" cy=\"48\" r=\"10\" fill=\"#F59E0B\" stroke=\"white\" data-f2c-idx=\"1682\"></circle><path d=\"m43 48 3 3 6-6\" stroke=\"white\" data-f2c-idx=\"1683\"></path></g></svg>"} />
        <SvgGraphic className={styles["svg-15"]} html={"<svg width=\"64\" height=\"64\" viewBox=\"0 0 64 64\" id=\"svg960178927_484\" data-f2c-idx=\"1684\"><g fill=\"none\" stroke=\"#22C55E\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" data-f2c-idx=\"1685\"><circle cx=\"16\" cy=\"24\" r=\"6\" fill=\"#BBEFC8\" data-f2c-idx=\"1686\"></circle><circle cx=\"48\" cy=\"24\" r=\"6\" fill=\"#BBEFC8\" data-f2c-idx=\"1687\"></circle><path d=\"M7 44v-5a9 9 0 0 1 18 0v5m14 0v-5a9 9 0 0 1 18 0v5\" fill=\"#BBEFC8\" data-f2c-idx=\"1688\"></path><circle cx=\"32\" cy=\"20\" r=\"8\" fill=\"white\" data-f2c-idx=\"1689\"></circle><path d=\"M19 48v-7a13 13 0 0 1 26 0v7Z\" fill=\"white\" data-f2c-idx=\"1690\"></path><path d=\"m27 40 4 4 7-8\" data-f2c-idx=\"1691\"></path></g></svg>"} />
        <SvgGraphic className={styles["svg-15"]} html={"<svg width=\"64\" height=\"64\" viewBox=\"0 0 64 64\" id=\"svg1453749355_679\" data-f2c-idx=\"1692\"><g fill=\"none\" stroke=\"#6366F1\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" data-f2c-idx=\"1693\"><rect x=\"8\" y=\"13\" width=\"14\" height=\"39\" rx=\"4\" fill=\"#CED2FE\" data-f2c-idx=\"1694\"></rect><rect x=\"25\" y=\"13\" width=\"14\" height=\"39\" rx=\"4\" fill=\"white\" data-f2c-idx=\"1695\"></rect><rect x=\"42\" y=\"13\" width=\"14\" height=\"39\" rx=\"4\" fill=\"#CED2FE\" data-f2c-idx=\"1696\"></rect><path d=\"M12 20h6m11 0h6m11 0h6\" data-f2c-idx=\"1697\"></path><rect x=\"11\" y=\"26\" width=\"8\" height=\"9\" rx=\"2\" fill=\"#6366F1\" stroke=\"none\" data-f2c-idx=\"1698\"></rect><rect x=\"11\" y=\"39\" width=\"8\" height=\"6\" rx=\"2\" fill=\"white\" stroke=\"none\" data-f2c-idx=\"1699\"></rect><rect x=\"28\" y=\"26\" width=\"8\" height=\"15\" rx=\"2\" fill=\"#CED2FE\" stroke=\"none\" data-f2c-idx=\"1700\"></rect><path d=\"m46 30 2 2 4-5\" data-f2c-idx=\"1701\"></path></g></svg>"} />
        <SvgGraphic className={styles["svg-15"]} html={"<svg width=\"64\" height=\"64\" viewBox=\"0 0 64 64\" id=\"svg-1235629575_532\" data-f2c-idx=\"1702\"><g fill=\"none\" stroke=\"#8B5CF6\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" data-f2c-idx=\"1703\"><path d=\"M17 18h14v15m0 0H16v14m15-14h17v14\" data-f2c-idx=\"1704\"></path><rect x=\"7\" y=\"9\" width=\"19\" height=\"17\" rx=\"5\" fill=\"#DDD0FD\" data-f2c-idx=\"1705\"></rect><path d=\"m31 24 10 9-10 9-10-9Z\" fill=\"white\" data-f2c-idx=\"1706\"></path><rect x=\"7\" y=\"43\" width=\"18\" height=\"13\" rx=\"4\" fill=\"white\" data-f2c-idx=\"1707\"></rect><rect x=\"40\" y=\"43\" width=\"18\" height=\"13\" rx=\"4\" fill=\"#8B5CF6\" stroke=\"none\" data-f2c-idx=\"1708\"></rect><path d=\"m45 49 3 3 5-6\" stroke=\"white\" data-f2c-idx=\"1709\"></path></g></svg>"} />
        <SvgGraphic className={styles["svg-15"]} html={"<svg width=\"64\" height=\"64\" viewBox=\"0 0 64 64\" id=\"svg-1211945068_486\" data-f2c-idx=\"1710\"><g fill=\"none\" stroke=\"#F97360\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" data-f2c-idx=\"1711\"><circle cx=\"29\" cy=\"35\" r=\"22\" fill=\"#FFD0C3\" data-f2c-idx=\"1712\"></circle><circle cx=\"29\" cy=\"35\" r=\"15\" fill=\"white\" data-f2c-idx=\"1713\"></circle><circle cx=\"29\" cy=\"35\" r=\"7\" fill=\"#F97360\" stroke=\"none\" data-f2c-idx=\"1714\"></circle><path d=\"m29 35 19-19\" data-f2c-idx=\"1715\"></path><path d=\"m44 10 1 9 9 1 5-7-9-1-1-8Z\" fill=\"#F97360\" stroke=\"white\" stroke-width=\"1.5\" data-f2c-idx=\"1716\"></path><path d=\"m14 53-3 5m32-5 3 5\" data-f2c-idx=\"1717\"></path></g></svg>"} />
        <SvgGraphic className={styles["svg-16"]} html={"<svg id=\"2014752541\" display=\"block\" role=\"presentation\" viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\" data-f2c-idx=\"1718\"><path d=\"M 2 17 L 18 17 C 19.105 17 20 16.105 20 15 L 20 5 C 20 3.895 19.105 3 18 3 L 10.07 3 C 9.401 2.997 8.778 2.659 8.41 2.1 L 7.59 0.9 C 7.222 0.341 6.599 0.003 5.93 0 L 2 0 C 0.895 0 0 0.895 0 2 L 0 15 C 0 16.1 0.9 17 2 17 Z\" fill=\"transparent\" height=\"17px\" id=\"YxJK6h251\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(2 3)\" width=\"20px\" data-f2c-idx=\"1719\"></path><path d=\"M 0 0 L 0 4\" fill=\"transparent\" height=\"4px\" id=\"aSz2jL5e2\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(8 10)\" width=\"1px\" data-f2c-idx=\"1720\"></path><path d=\"M 0 0 L 0 2\" fill=\"transparent\" height=\"2px\" id=\"E_nzacAKn\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(12 10)\" width=\"1px\" data-f2c-idx=\"1721\"></path><path d=\"M 0 0 L 0 6\" fill=\"transparent\" height=\"6px\" id=\"nbcrft82D\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(16 10)\" width=\"1px\" data-f2c-idx=\"1722\"></path></svg>"} />
        <SvgGraphic className={styles["svg-16"]} html={"<svg id=\"2932616460\" display=\"block\" role=\"presentation\" viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\" data-f2c-idx=\"1723\"><path d=\"M 1 4 C 0.448 4 0 3.552 0 3 L 0 1 C 0 0.448 0.448 0 1 0 L 7 0 C 7.552 0 8 0.448 8 1 L 8 3 C 8 3.552 7.552 4 7 4 Z\" fill=\"transparent\" height=\"4px\" id=\"XEjDMegtD\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(8 2)\" width=\"8px\" data-f2c-idx=\"1724\"></path><path d=\"M 12 0 L 14 0 C 15.105 0 16 0.895 16 2 L 16 16 C 16 17.105 15.105 18 14 18 L 2 18 C 0.895 18 0 17.105 0 16 L 0 2 C 0 0.895 0.895 0 2 0 L 4 0\" fill=\"transparent\" height=\"18px\" id=\"zWuobGV0h\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(4 4)\" width=\"16px\" data-f2c-idx=\"1725\"></path><path d=\"M 0 0 L 4 0\" fill=\"transparent\" height=\"1px\" id=\"VbFmdcJ5s\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(12 11)\" width=\"4px\" data-f2c-idx=\"1726\"></path><path d=\"M 0 0 L 4 0\" fill=\"transparent\" height=\"1px\" id=\"RlWX3ZVBC\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(12 16)\" width=\"4px\" data-f2c-idx=\"1727\"></path><path d=\"M 0 0 L 0.01 0\" fill=\"transparent\" height=\"1px\" id=\"pWNSw4YsW\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(8 11)\" width=\"1px\" data-f2c-idx=\"1728\"></path><path d=\"M 0 0 L 0.01 0\" fill=\"transparent\" height=\"1px\" id=\"k_KiBUvYK\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(8 16)\" width=\"1px\" data-f2c-idx=\"1729\"></path></svg>"} />
        <SvgGraphic className={styles["svg-16"]} html={"<svg id=\"1298086186\" display=\"block\" role=\"presentation\" viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\" data-f2c-idx=\"1730\"><path d=\"M 0.993 14.342 C 1.14 14.713 1.172 15.119 1.087 15.509 L 0.022 18.799 C -0.048 19.138 0.063 19.489 0.314 19.727 C 0.566 19.965 0.923 20.056 1.258 19.967 L 4.671 18.969 C 5.038 18.896 5.419 18.928 5.77 19.061 C 10.178 21.12 15.429 19.707 18.208 15.713 C 20.988 11.72 20.49 6.305 17.029 2.886 C 13.567 -0.533 8.147 -0.965 4.188 1.863 C 0.229 4.691 -1.12 9.959 0.993 14.342\" fill=\"transparent\" height=\"20.001099500791895px\" id=\"Y4j4ZoNg1\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(1.999 2)\" width=\"20.001077173205804px\" data-f2c-idx=\"1731\"></path></svg>"} />
        <SvgGraphic className={styles["svg-16"]} html={"<svg id=\"2126520362\" display=\"block\" role=\"presentation\" viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\" data-f2c-idx=\"1732\"><path d=\"M 0 0 L 20 0\" fill=\"transparent\" height=\"1px\" id=\"IR0ucwWJZ\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(2 3)\" width=\"20px\" data-f2c-idx=\"1733\"></path><path d=\"M 18 0 L 18 11 C 18 12.105 17.105 13 16 13 L 2 13 C 0.895 13 0 12.105 0 11 L 0 0\" fill=\"transparent\" height=\"13px\" id=\"VekeQvGFU\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(3 3)\" width=\"18px\" data-f2c-idx=\"1734\"></path><path d=\"M 0 5 L 5 0 L 10 5\" fill=\"transparent\" height=\"5px\" id=\"uHpaBxNUN\" stroke-dasharray=\"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"var(--js9iwy, 2)\" stroke=\"var(--1m973uw, rgb(0,0,0))\" transform=\"translate(7 16)\" width=\"10px\" data-f2c-idx=\"1735\"></path></svg>"} />
      </div>
      <div className={styles["div-92"]}>
        <span className={styles["span-65"]}>{slots[0] ?? "Edit Content"}</span>
        <button className={styles["button-4"]}>
          <SvgGraphic className={styles["svg-17"]} html={"<svg role=\"presentation\" xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" fill=\"none\" data-f2c-idx=\"1739\"><path d=\"M1 9.414a1 1 0 0 1 .293-.707l7.469-7.469a1.75 1.75 0 0 1 2.476 0l1.524 1.524a1.75 1.75 0 0 1 0 2.476l-7.469 7.469a1 1 0 0 1-.707.293H2a1 1 0 0 1-1-1zM11.5 6.5l-4-4\" fill=\"transparent\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" data-f2c-idx=\"1740\"></path></svg>"} />
        </button>
      </div>
      <div className={styles["iframe"]} />
    </>
  )
}
