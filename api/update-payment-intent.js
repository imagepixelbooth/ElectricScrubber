const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
        const { paymentIntentId, items, state } = req.body;

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

            // Tax Logic
            let tax = 0;
            if (state && (state.toLowerCase() === 'nj' || state.toLowerCase() === 'new jersey')) {
                tax = Math.round(amount * 0.06625);
            }

            return { total: Math.round(amount + tax), tax: tax };
        };

        const { total, tax } = calculateOrderAmount(items, state);

        // Update Stripe PaymentIntent
        await stripe.paymentIntents.update(paymentIntentId, {
            amount: total
        });

        res.status(200).json({
            amount: total,
            tax: tax
        });
    } catch (e) {
        res.status(400).json({
            error: {
                message: e.message,
            },
        });
    }
};
