document.addEventListener("DOMContentLoaded", () => {

    // Add a small visual indicator to external links.
    document.querySelectorAll(".md-content a[href^='http']").forEach(link => {

        if (link.hostname !== window.location.hostname) {
            link.setAttribute("target", "_blank");
            link.setAttribute("rel", "noopener noreferrer");
        }

    });

});