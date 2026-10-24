(() => {
    // Prevent duplicate cursor initialization.
    if (document.querySelector(".cursor-dot")) return;

    const cursorDot = document.createElement("div");
    cursorDot.className = "cursor-dot";
    cursorDot.setAttribute("aria-hidden", "true");
    document.body.appendChild(cursorDot);

    let mouseX = 0;
    let mouseY = 0;
    let dotX = 0;
    let dotY = 0;
    let hasMoved = false;

    const speed = 0.12;

    document.addEventListener("mousemove", (event) => {
        mouseX = event.clientX;
        mouseY = event.clientY;

        // Place the dot at the cursor immediately on first movement.
        if (!hasMoved) {
            dotX = mouseX;
            dotY = mouseY;
            hasMoved = true;
            cursorDot.style.opacity = "1";
        }
    });

    function animateCursor() {
        if (hasMoved) {
            dotX += (mouseX - dotX) * speed;
            dotY += (mouseY - dotY) * speed;

            cursorDot.style.left = `${dotX}px`;
            cursorDot.style.top = `${dotY}px`;
        }

        requestAnimationFrame(animateCursor);
    }

    animateCursor();
})();