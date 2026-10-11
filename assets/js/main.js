// Kingsley Koduah — portfolio interactions

(function () {
    const nav = document.querySelector('.nav');
    const toggle = document.getElementById('nav-toggle');
    const links = document.getElementById('nav-links');

    // Mobile menu
    toggle.addEventListener('click', () => {
        const open = links.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open);
        toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    links.querySelectorAll('a').forEach((a) =>
        a.addEventListener('click', () => {
            links.classList.remove('open');
            toggle.setAttribute('aria-expanded', 'false');
        })
    );

    // Nav border once scrolled
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Highlight the current section in the nav
    const navLinks = [...links.querySelectorAll('a[href^="#"]:not(.btn)')];
    const sections = navLinks.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    if ('IntersectionObserver' in window) {
        const spy = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (!e.isIntersecting) return;
                navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        sections.forEach((s) => spy.observe(s));
    }

    // Reveal on scroll + fill skill bars
    const revealTargets = document.querySelectorAll(
        '.section-head, .statement, .about-text, .project, .tool-card, .steps li, .timeline li, .contact-card'
    );
    const fillBars = (root) =>
        root.querySelectorAll('[data-level]').forEach((li) => li.style.setProperty('--fill', li.dataset.level + '%'));

    if ('IntersectionObserver' in window) {
        revealTargets.forEach((el) => el.classList.add('reveal'));
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (!e.isIntersecting) return;
                e.target.classList.add('in');
                fillBars(e.target);
                io.unobserve(e.target);
            });
        }, { threshold: 0.12 });
        revealTargets.forEach((el) => io.observe(el));
    } else {
        fillBars(document);
    }

    document.getElementById('year').textContent = new Date().getFullYear();
})();
