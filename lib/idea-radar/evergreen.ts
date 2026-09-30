export type EvergreenAngle = {
  angle: string;
  why: string;
  evidence: string;
};

export type EvergreenIdea = {
  key: string;
  title: string;
  description: string;
  whyInteresting: string;
  insight: string;
  category: string;
  angles: EvergreenAngle[];
};

const angleSet = (title: string): EvergreenAngle[] => [
  {
    angle: `The assumption behind: ${title}`,
    why: "Challenge a common assumption and turn the topic into a practical leadership or work lesson.",
    evidence: "Use the idea itself as the starting point and add a concrete personal or workplace example.",
  },
  {
    angle: `What this means in everyday work: ${title}`,
    why: "Translate the concept into a situation most professionals can recognize.",
    evidence: "Connect the idea to a familiar decision, habit, conversation, or team situation.",
  },
  {
    angle: `The overlooked lesson in: ${title}`,
    why: "Look for the less obvious lesson rather than repeating the surface-level advice.",
    evidence: "Use a simple example, observation, or experience to make the lesson tangible.",
  },
];

const makeIdea = (
  key: string,
  title: string,
  description: string,
  whyInteresting: string,
  insight: string,
  category: string,
): EvergreenIdea => ({
  key,
  title,
  description,
  whyInteresting,
  insight,
  category,
  angles: angleSet(title),
});

export const EVERGREEN_IDEAS: EvergreenIdea[] = [
  makeIdea("leadership-01","Why good leaders ask better questions","Leadership is often associated with having answers, but strong leaders also know how to ask questions that help people think.","It is relatable to managers, founders, and anyone who leads a team.","A useful question can create ownership instead of dependence.","Leadership"),
  makeIdea("leadership-02","The difference between authority and influence","A job title can give someone authority, but influence is built through trust, consistency, and the ability to understand people.","It creates a practical way to discuss leadership without relying on hierarchy.","People may follow an instruction because they have to, but they engage differently when they trust the person giving it.","Leadership"),
  makeIdea("leadership-03","Why leaders need to tolerate uncertainty","Many decisions have to be made before all the information is available.","This connects leadership to a situation almost every professional experiences.","Good decision-making is not the same as having perfect information; it is making a reasonable decision while knowing what is still uncertain.","Leadership"),
  makeIdea("leadership-04","The hidden cost of leaders solving every problem","A leader who fixes everything can accidentally teach the team to wait for answers.","It exposes a subtle problem that can exist inside otherwise helpful management.","Sometimes the best leadership response is to create the conditions for someone else to solve the problem.","Leadership"),

  makeIdea("entrepreneurship-01","Why small experiments beat big assumptions","Entrepreneurs often have to make decisions before they know whether an idea will work.","It turns entrepreneurship into a practical lesson about learning rather than hype.","A small experiment can replace a large assumption with real evidence.","Entrepreneurship"),
  makeIdea("entrepreneurship-02","The problem with falling in love with an idea","A founder can become attached to a solution before fully understanding the problem.","This is useful for founders and professionals working on new products or initiatives.","The goal is not to protect an idea; it is to learn what actually creates value.","Entrepreneurship"),
  makeIdea("entrepreneurship-03","Why constraints can improve creativity","Limited time, money, people, or tools can force clearer choices.","The topic is relevant far beyond startups.","Constraints can remove unnecessary possibilities and make the important decision easier to see.","Entrepreneurship"),
  makeIdea("entrepreneurship-04","The difference between persistence and stubbornness","Both persistence and stubbornness can look similar from the outside.","It creates a useful discussion about when to continue and when to change direction.","Persistence keeps the goal alive; stubbornness can keep the original method alive even after the evidence changes.","Entrepreneurship"),

  makeIdea("career-01","Your career is not the same as your job","A job is a current role; a career is the collection of skills, relationships, experiences, and choices built over time.","It helps professionals think beyond their current title.","Career progress can come from learning and responsibility even when the job title does not change.","Career"),
  makeIdea("career-02","Why being good at your job is not the whole career game","Technical ability matters, but communication, judgment, relationships, and adaptability also shape professional opportunities.","It gives professionals a broader way to think about growth.","Career capital is built from multiple capabilities, not one skill alone.","Career"),
  makeIdea("career-03","The hidden value of learning things outside your role","Skills from another field can change how you approach your main work.","It is useful for people who feel that learning outside their job is a distraction.","Cross-functional knowledge can create connections that are invisible when learning stays inside one narrow specialty.","Career"),
  makeIdea("career-04","Why career progress can feel invisible","Some of the most valuable professional growth happens gradually through better judgment, confidence, and problem-solving.","It makes an abstract career problem easy to relate to.","Growth is often easier to notice in hindsight than while it is happening.","Career"),

  makeIdea("psychology-01","Why people resist change even when change makes sense","Knowing that something is rational does not automatically make it emotionally easy to accept.","It connects psychology to work, relationships, and everyday decisions.","People respond to uncertainty and loss as well as to logic, so change needs more than a good argument.","Psychology"),
  makeIdea("psychology-02","Why people remember stories better than lists","Information becomes easier to connect with when it has context, sequence, and meaning.","It is useful for communication, presentations, teaching, and LinkedIn writing.","People do not experience information as isolated facts; context helps turn facts into something memorable.","Psychology"),
  makeIdea("psychology-03","The difference between being busy and making progress","Activity can create the feeling of movement without necessarily moving an important goal forward.","It is immediately relevant to professionals and teams.","Progress requires a connection between effort and an outcome that matters.","Psychology"),
  makeIdea("psychology-04","Why first impressions can be hard to change","People naturally use early information to build a picture of someone or something.","It creates a simple entry point into a broader discussion about judgment.","Once a mental model is formed, new information may be interpreted through that model rather than viewed from scratch.","Psychology"),

  makeIdea("productivity-01","Why reducing tasks can improve productivity","Productivity is often treated as doing more, but removing unnecessary work can create more useful capacity.","The idea challenges the usual productivity checklist.","The best productivity system is not the one that fits the most tasks; it is the one that protects important work.","Productivity"),
  makeIdea("productivity-02","The hidden cost of context switching","Moving repeatedly between unrelated tasks creates friction even when each individual task looks small.","It is easy for almost any professional to recognize.","Protecting blocks of attention can matter as much as improving the speed of individual tasks.","Productivity"),
  makeIdea("productivity-03","Why starting is often harder than continuing","The mental barrier before a task can be larger than the task itself.","It turns a common procrastination problem into a practical observation.","Reducing the size of the first step can make action easier without needing more motivation.","Productivity"),
  makeIdea("productivity-04","The productivity trap of optimizing everything","Constantly improving tools and systems can become another form of avoidance.","It is especially relevant in a world full of productivity apps and workflows.","A simple system used consistently can be more valuable than a sophisticated system that demands constant attention.","Productivity"),

  makeIdea("personal-growth-01","Why discomfort can be a sign of learning","New skills and unfamiliar situations often feel less comfortable than familiar routines.","It provides a balanced way to talk about growth without pretending all discomfort is useful.","Useful discomfort often comes from doing something that expands capability, not simply from suffering.","Personal Growth"),
  makeIdea("personal-growth-02","The difference between confidence and certainty","Confidence can mean trusting yourself to handle uncertainty; certainty assumes the answer is already known.","It is relevant to decision-making and personal development.","Healthy confidence leaves room for learning and changing your mind.","Personal Growth"),
  makeIdea("personal-growth-03","Why comparison can hide your own progress","Looking only at other people's visible outcomes can make your own gradual improvement difficult to see.","It is a relatable topic for professionals and creators.","A useful comparison is often between your current capability and your previous capability.","Personal Growth"),
  makeIdea("personal-growth-04","The value of changing your mind","Changing a belief after learning something new can be a sign of learning rather than weakness.","It creates a thoughtful topic for a professional audience.","Strong thinking is not about never changing your position; it is about having a reason for the change.","Personal Growth"),

  makeIdea("management-01","Why clarity is a management skill","Teams can struggle even when everyone is working hard if priorities and ownership are unclear.","It turns an everyday management problem into a useful lesson.","Clear expectations reduce the amount of energy people spend guessing what matters.","Management"),
  makeIdea("management-02","The difference between feedback and criticism","Both can point out a problem, but they create different conversations when the focus is on improvement rather than blame.","It is practical for managers and team members.","Useful feedback describes what happened, why it matters, and what could be different next time.","Management"),
  makeIdea("management-03","Why meetings multiply when decisions are unclear","Teams often schedule another meeting when nobody knows who owns the next decision.","It connects meeting overload to a deeper operating problem.","A meeting can discuss a problem without resolving the question of who decides what happens next.","Management"),
  makeIdea("management-04","Why delegation is more than assigning tasks","Delegation involves transferring enough context, authority, and responsibility for another person to own the outcome.","It helps distinguish delegation from simply distributing work.","Good delegation develops capability while freeing the manager to focus on higher-level work.","Management"),

  makeIdea("interesting-01","Why simple ideas can be surprisingly powerful","An idea does not need to be complicated to change how someone sees a familiar problem.","It works well as a broad content theme across industries.","The value of an idea often comes from the connection it creates, not from how complicated it sounds.","Interesting Stories"),
  makeIdea("interesting-02","The lessons hidden inside everyday failures","Small failures often reveal assumptions that success allows people to overlook.","It gives creators a way to turn ordinary experiences into useful stories.","A failure becomes valuable when the lesson is made specific enough to change future behavior.","Interesting Stories"),
  makeIdea("interesting-03","Why unusual examples make familiar lessons memorable","A familiar lesson can feel new when it is explained through an unexpected example.","It is directly useful for creating engaging professional content.","Novelty can attract attention, while a useful underlying lesson gives that attention a reason to continue.","Interesting Stories"),
  makeIdea("interesting-04","What everyday systems can teach us about people","Queues, traffic, offices, markets, and other systems reveal how people behave when incentives and constraints change.","It opens a wide range of observation-based content ideas.","Looking at ordinary systems from a different perspective can reveal patterns that are easy to miss in daily life.","Interesting Stories"),

  makeIdea("motivation-01","Why motivation often follows action","People sometimes wait to feel motivated before starting, even though beginning a small action can change their mental state.","It addresses a common problem without relying on motivational slogans.","Action can create evidence of progress, which can make the next action easier.","Motivation"),
  makeIdea("motivation-02","Why meaningful goals matter more than endless discipline","Discipline can help with execution, but people also need a reason for continuing.","It creates a more nuanced motivation discussion.","A goal becomes easier to sustain when the person understands why the effort matters.","Motivation"),
  makeIdea("motivation-03","The difference between pressure and purpose","Pressure can push people temporarily, while purpose can provide a reason to continue when conditions change.","It is relevant to work, leadership, and personal goals.","Sustainable effort usually needs more than fear of consequences.","Motivation"),
  makeIdea("motivation-04","Why visible progress can change how effort feels","A difficult task can feel different once a person can see that effort is producing movement.","It connects motivation with practical goal design.","Breaking a large goal into visible milestones can make progress easier to recognize.","Motivation"),
];

export function evergreenAngles(idea: EvergreenIdea) {
  return idea.angles;
}
