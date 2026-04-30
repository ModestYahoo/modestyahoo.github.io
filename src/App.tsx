import './App.css'

export default function App() {
  return (
    <div className="container">
      <header className="header">
        <h1>Welcome to My Portfolio</h1>
        <p className="subtitle">Full Stack Developer | React Enthusiast</p>
      </header>

      <main>
        <section className="hero">
          <h2>About Me</h2>
          <p>
            I'm a passionate developer building beautiful and functional web applications.
            Specializing in React, TypeScript, and modern web technologies.
          </p>
        </section>

        <section className="projects">
          <h2>Featured Projects</h2>
          <div className="project-grid">
            <div className="project-card">
              <h3>Project One</h3>
              <p>A brief description of your first project and what you built.</p>
              <a href="#" className="project-link">View Project →</a>
            </div>
            <div className="project-card">
              <h3>Project Two</h3>
              <p>A brief description of your second project and technologies used.</p>
              <a href="#" className="project-link">View Project →</a>
            </div>
            <div className="project-card">
              <h3>Project Three</h3>
              <p>A brief description of your third project and key features.</p>
              <a href="#" className="project-link">View Project →</a>
            </div>
          </div>
        </section>

        <section className="skills">
          <h2>Skills</h2>
          <div className="skills-list">
            <span className="skill-badge">React</span>
            <span className="skill-badge">TypeScript</span>
            <span className="skill-badge">JavaScript</span>
            <span className="skill-badge">CSS</span>
            <span className="skill-badge">Node.js</span>
            <span className="skill-badge">Git</span>
          </div>
        </section>

        <section className="contact">
          <h2>Get In Touch</h2>
          <p>I'm always interested in new opportunities and collaborations.</p>
          <div className="contact-links">
            <a href="mailto:your.email@example.com" className="contact-link">Email</a>
            <a href="https://github.com" className="contact-link">GitHub</a>
            <a href="https://linkedin.com" className="contact-link">LinkedIn</a>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>&copy; 2026 Your Name. All rights reserved.</p>
      </footer>
    </div>
  )
}
