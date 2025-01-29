document.addEventListener("DOMContentLoaded", () => {
    // Simulating fetching products from the server
    fetch('/products?query=gold')
        .then(response => response.text())
        .then(data => {
            document.getElementById('product-list').innerHTML = data;
        });
});
