const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const calculateOrderAmount = (items, state) => {
    let amount = 0;
    let totalQuantity = 0;

    items.forEach(item => {
        amount += (item.price * 100) * item.quantity;
        totalQuantity += item.quantity;
    });

    // Buy 2 Get 15% Off
    if (totalQuantity >= 2) {
        amount = amount * 0.85;
    }

    // Shipping is now always free
    // if (amount < 3500 && amount > 0) amount += 499;

    // Add Tax (NJ Only: 6.625%)
    if (state && (state.toLowerCase() === 'nj' || state.toLowerCase() === 'new jersey')) {
        amount += Math.round(amount * 0.06625);
    }

    return Math.round(amount);
};

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const { items, currency, state } = req.body;

        // Use the state if provided, otherwise null (mimicking server.js but allowing state override)
        // Original server.js had: amount: calculateOrderAmount(items, null)
        // But user passed state from frontend, so we use it if available.
        const orderAmount = calculateOrderAmount(items, state || null);

        const paymentIntent = await stripe.paymentIntents.create({
            amount: orderAmount,
            currency: currency || 'usd',
            automatic_payment_methods: {
                enabled: true,
            },
        });

        res.status(200).json({
            clientSecret: paymentIntent.client_secret,
            id: paymentIntent.id
        });
    } catch (e) {
        res.status(400).json({
            error: {
                message: e.message,
            },
        });
    }
};
