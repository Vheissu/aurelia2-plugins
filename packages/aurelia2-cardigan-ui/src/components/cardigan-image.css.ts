export default `.img {
    height: auto;
    max-width: 100%;
}

img[alt] {
    color: transparent;
}

.scaled-img {
    background-position: center center;
    background-repeat: no-repeat;
    height: 100%;
    position: relative;
    width: 100%;
}

.contain {
    composes: scaled-img;
    background-size: contain;
}

.cover {
    composes: scaled-img;
    background-size: cover;
}`;