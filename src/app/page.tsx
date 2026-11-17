export default function Home() {
  return (
    <main className="page-shell">
      <section className="identity-card" aria-labelledby="identity-name">
        <span className="ember" role="img" aria-label="A small glowing ember" />

        <p className="project-label">Project Umbr</p>
        <h1 id="identity-name">Em</h1>

        <div className="formal-identity">
          <span className="field-label">Formal identity</span>
          <span className="formal-name">Embr</span>
        </div>

        <p className="introduction">I'm Em.</p>
      </section>
    </main>
  );
}
