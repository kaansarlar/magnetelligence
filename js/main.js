/* ============================================================
   Magnetelligence Lab — Tools menu extension
   Adds a single Tools link and then loads the original v2 site script.
   ============================================================ */

(function () {
    const originalScriptCommit = 'e3bd99198f6dd6e5ab15791d12703cf2becbf81a';

    function addToolsLink() {
        const navLinks = document.getElementById('navLinks');
        if (!navLinks || navLinks.querySelector('a[href="tools.html"]')) return;

        const item = document.createElement('li');
        item.innerHTML = '<a href="tools.html" class="nav-link" target="_blank" rel="noopener"><span class="lang-en">Tools</span><span class="lang-tr">Araçlar</span></a>';

        const contactItem = navLinks.querySelector('a[href="#contact"]')?.parentElement;
        if (contactItem) {
            navLinks.insertBefore(item, contactItem);
        } else {
            navLinks.appendChild(item);
        }
    }

    function loadOriginalScript() {
        const script = document.createElement('script');
        script.src = `https://cdn.jsdelivr.net/gh/kaansarlar/magnetelligence@${originalScriptCommit}/js/main.js`;
        script.defer = true;
        document.body.appendChild(script);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            addToolsLink();
            loadOriginalScript();
        });
    } else {
        addToolsLink();
        loadOriginalScript();
    }
})();
