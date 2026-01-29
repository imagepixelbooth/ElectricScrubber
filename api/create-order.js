const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Debug Logs
console.log("--- Create Order Handler ---");
console.log("Supabase URL present:", !!supabaseUrl);
console.log("Supabase Key present:", !!supabaseKey);

const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

if (!supabase) {
    console.warn("WARNING: Supabase client NOT initialized. Check .env variables.");
}

/**
 * CleanPro / ViralTrenz Order Processing Function
 * 
 * Logic:
 * 1. Generates a unique, human-readable Order ID.
 * 2. Compiles a beautiful HTML email with the order summary.
 * 3. Sends the email via Nodemailer (SendGrid/SMTP).
 */

// 1. Order ID Generator
function generateOrderId() {
    const prefix = 'ORD';
    const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
    const random = Math.floor(1000 + Math.random() * 9000); // 4-digit random
    return `${prefix}-${timestamp}-${random}`;
}

// 2. HTML Email Template Generator
const generateEmailHtml = (orderId, items, total) => {
    // Generate Item Rows
    const rows = items.map(item => `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px;">
                <img src="${item.image}" width="50" style="border-radius:5px; vertical-align:middle; margin-right: 10px;">
                <strong>${item.title}</strong> <span style="color:#777; font-size:0.9em;">(${item.color})</span>
            </td>
            <td style="padding: 10px; white-space: nowrap;">x ${item.quantity}</td>
            <td style="padding: 10px; white-space: nowrap;">$${(item.price * item.quantity).toFixed(2)}</td>
        </tr>
    `).join('');

    // Full HTML Structure
    return `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e1e4e8; border-radius: 8px; overflow: hidden; color: #333;">
            <div style="background-color: #0fbcf9; padding: 20px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 24px;">Order Confirmed!</h1>
            </div>
            
            <div style="padding: 20px;">
                <p style="font-size: 16px; line-height: 1.5;">Hi there,</p>
                <p style="font-size: 16px; line-height: 1.5;">Thank you for shopping with <strong>ViralTrenz</strong>. We have received your order and are getting it ready!</p>
                
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0; text-align: center;">
                    <span style="display: block; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px;">Order ID</span>
                    <strong style="font-size: 20px; color: #333;">${orderId}</strong>
                </div>

                <h3 style="border-bottom: 2px solid #0fbcf9; padding-bottom: 10px; margin-top: 30px;">Order Summary</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <thead>
                        <tr style="background-color: #f1f1f1;">
                            <th style="padding: 10px; text-align: left;">Item</th>
                            <th style="padding: 10px; text-align: left;">Qty</th>
                            <th style="padding: 10px; text-align: left;">Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2" style="padding: 15px; text-align: right; font-weight: bold; border-top: 2px solid #333;">Grand Total</td>
                            <td style="padding: 15px; font-weight: bold; font-size: 18px; border-top: 2px solid #333;">$${total}</td>
                        </tr>
                    </tfoot>
                </table>

                <div style="margin-top: 40px; text-align: center; font-size: 13px; color: #999;">
                    <p>If you have any questions, reply to this email.</p>
                    <p>&copy; ${new Date().getFullYear()} ViralTrenz. All rights reserved.</p>
                </div>
            </div>
        </div>
    `;
};

// 3. Serverless Handler (Vercel/Node style)
module.exports = async (req, res) => {
    // Enable CORS if needed
    // res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'POST') {
        try {
            const { email, items, total, shipping } = req.body; // 'shipping' contains name/address
            const orderId = generateOrderId();

            // 1. Save to Supabase (if configured)
            if (supabase) {
                console.log("Attempting to save order to Supabase:", orderId);
                console.log("Shipping Data:", JSON.stringify(shipping || {}));

                const { error: dbError } = await supabase
                    .from('orders')
                    .insert([
                        {
                            id: orderId,
                            email: email,
                            total: total,
                            items: items,
                            shipping_address: shipping, // Includes name
                            name: shipping ? shipping.name : null, // Extract name specificially if column exists
                            created_at: new Date()
                        }
                    ]);

                if (dbError) {
                    console.error("Supabase SAVE Error:", dbError);
                } else {
                    console.log("SUCCESS: Order saved to Supabase:", orderId);
                }
            } else {
                console.log("Skipping Supabase save (Client is null)");
            }

            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.example.com',
                port: 587,
                secure: false,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });

            // Send
            const htmlContent = generateEmailHtml(orderId, items, total);

            await transporter.sendMail({
                from: `"ViralTrenz" <${process.env.SMTP_FROM_EMAIL || 'orders@viraltrenz.com'}>`,
                to: email, // User's email
                subject: `Order Confirmation ${orderId}`,
                html: htmlContent
            });

            // Success Response
            res.status(200).json({
                success: true,
                orderId: orderId,
                message: 'Order created and email sent'
            });

        } catch (error) {
            console.error('Order Error:', error);
            // Return specific error message for debugging
            res.status(500).json({
                success: false,
                error: error.message || 'Unknown error occurred',
                details: error.toString(),
                debug_from: `"${process.env.SMTP_FROM_NAME || 'ViralTrenz'}" <${process.env.SMTP_FROM_EMAIL || 'orders@viraltrenz.com'}>`
            });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
