const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const calculateOrderAmount = (items, state, promoCode) => {
    let amount = 0;
    items.forEach(item => {
        amount += (item.price * 100) * item.quantity;
    });

    // Shipping is now always free
    // if (amount < 3500 && amount > 0) amount += 499;

    // Apply Discounts
    if (promoCode === 'FAVORITE99') {
        amount = Math.round(amount * 0.01); // 99% OFF
    } else if (promoCode === 'VIRAL10') {
        amount = Math.round(amount * 0.90); // 10% OFF
    }

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
        const { items, currency, state, promoCode } = req.body;

        // Use the state if provided, otherwise null (mimicking server.js but allowing state override)
        // Original server.js had: amount: calculateOrderAmount(items, null)
        // But user passed state from frontend, so we use it if available.
        const orderAmount = calculateOrderAmount(items, state || null, promoCode);

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
