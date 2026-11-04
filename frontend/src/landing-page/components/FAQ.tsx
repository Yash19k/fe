import styles from "../styles/styles.module.css"
import Seperator from "./Seperator"
import FAQSection from "./FAQSection"

export default function FAQ({ slots = [] }: { slots?: string[] }) {
  return (
    <section id="faq" className={styles["faq-2"]}>
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
  )
}

