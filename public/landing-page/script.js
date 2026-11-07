// Theme Toggle
const themeToggle = document.getElementById('themeToggle');
const body = document.body;

// Check for saved theme preference or default to light mode
const currentTheme = localStorage.getItem('theme') || 'light';
body.setAttribute('data-theme', currentTheme);

themeToggle.addEventListener('click', () => {
    const currentTheme = body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
});

// Smooth Scroll for Navigation Links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const navHeight = document.querySelector('.nav').offsetHeight;
            const targetPosition = target.offsetTop - navHeight;
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// Intersection Observer for Fade-in Animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('fade-in');
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Observe elements for animation
document.addEventListener('DOMContentLoaded', () => {
    const animateElements = document.querySelectorAll(
        '.feature-card, .step-card, .testimonial-card, .pricing-card, .chat-message'
    );
    
    animateElements.forEach((el, index) => {
        el.style.animationDelay = `${index * 0.1}s`;
        observer.observe(el);
    });
});

// Parallax Effect for Hero Section
let lastScroll = 0;
const heroVisual = document.querySelector('.hero-visual');

window.addEventListener('scroll', () => {
    const scrollTop = window.pageYOffset;
    const heroSection = document.querySelector('.hero');
    const heroHeight = heroSection.offsetHeight;
    
    if (scrollTop < heroHeight && heroVisual) {
        const parallaxValue = scrollTop * 0.5;
        heroVisual.style.transform = `translateY(${parallaxValue}px)`;
    }
});

// Navbar Background on Scroll
const nav = document.querySelector('.nav');
let lastScrollY = window.scrollY;

window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        nav.style.background = 'rgba(255, 255, 255, 0.95)';
        if (body.getAttribute('data-theme') === 'dark') {
            nav.style.background = 'rgba(29, 29, 31, 0.95)';
        }
    } else {
        nav.style.background = 'rgba(255, 255, 255, 0.8)';
        if (body.getAttribute('data-theme') === 'dark') {
            nav.style.background = 'rgba(29, 29, 31, 0.8)';
        }
    }
    lastScrollY = window.scrollY;
});

// Chat Message Animation (Staggered)
const chatMessages = document.querySelectorAll('.chat-message');
chatMessages.forEach((message, index) => {
    message.style.opacity = '0';
    message.style.transform = 'translateY(10px)';
    
    setTimeout(() => {
        message.style.transition = 'all 0.5s ease-out';
        message.style.opacity = '1';
        message.style.transform = 'translateY(0)';
    }, index * 300);
});

// Button Hover Effects
document.querySelectorAll('.btn-primary, .btn-secondary').forEach(button => {
    button.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-2px)';
    });
    
    button.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
    });
});

// Device Mockup 3D Tilt Effect
const deviceMockup = document.querySelector('.device-mockup');
if (deviceMockup) {
    deviceMockup.addEventListener('mousemove', (e) => {
        const rect = deviceMockup.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = (y - centerY) / 10;
        const rotateY = (centerX - x) / 10;
        
        deviceMockup.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });
    
    deviceMockup.addEventListener('mouseleave', () => {
        deviceMockup.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)';
    });
}

// Preview Mockup Hover Effect
const previewMockup = document.querySelector('.preview-mockup');
if (previewMockup) {
    previewMockup.addEventListener('mousemove', (e) => {
        const rect = previewMockup.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = (y - centerY) / 20;
        const rotateY = (centerX - x) / 20;
        
        previewMockup.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });
    
    previewMockup.addEventListener('mouseleave', () => {
        previewMockup.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)';
    });
}

// Add smooth reveal animation to sections
const sections = document.querySelectorAll('section');
const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, {
    threshold: 0.1
});

sections.forEach(section => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(20px)';
    section.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
    sectionObserver.observe(section);
});

// Initialize first section immediately
if (sections[0]) {
    sections[0].style.opacity = '1';
    sections[0].style.transform = 'translateY(0)';
}

