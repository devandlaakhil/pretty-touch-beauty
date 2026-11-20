export const defaultCategories = [
    { id: 'skin', name: 'Skin Care', icon: '✨', items: [['Basic Facial', 'A refreshing facial for everyday skin care.'], ['Fruit Facial', 'A fruit-based facial for a fresh, glowing look.'], ['Gold Facial', 'A nourishing facial for a radiant finish.'], ['Clean-up', 'A quick cleanse to refresh your skin.'], ['De-tan', 'A skin treatment to help reduce the look of tan.'], ['Bleach', 'A beauty treatment for a more even-looking appearance.'], ['Face Pack', 'A relaxing face pack suited to your skin.']] },
    { id: 'hair', name: 'Hair Care', icon: '💇‍♀️', items: [['Hair Oil Massage', 'A relaxing scalp and hair oil massage.'], ['Hair Spa', 'A nourishing hair spa treatment.'], ['Hair Wash', 'A refreshing hair wash.'], ['Hair Styling', 'Style your hair for your special day.'], ['Hair Straightening (basic styling)', 'Basic hair straightening and styling.']] },
    { id: 'waxing', name: 'Waxing', icon: '🌸', items: [['Full Hands Waxing', ''], ['Half Hands Waxing', ''], ['Full Legs Waxing', ''], ['Underarms Waxing', ''], ['Full Body Waxing', '']] },
    { id: 'threading', name: 'Threading', icon: '🪷', items: [['Eyebrow Threading', ''], ['Upper Lip', ''], ['Forehead', ''], ['Chin Threading', '']] },
    { id: 'makeup', name: 'Makeup', icon: '💄', items: [['Party Makeup', 'Get party-ready with a look tailored to your occasion.'], ['Engagement Makeup', 'A polished makeup look for your engagement.'], ['Bridal Makeup', 'A beautiful bridal look for your big day.'], ['Saree Draping', 'Professional saree draping for special occasions.']] },
    { id: 'nails', name: 'Manicure & Pedicure', icon: '💅', items: [['Basic Manicure', ''], ['Basic Pedicure', ''], ['Foot Spa', ''], ['Hand & Foot Care', '']] },
    { id: 'special', name: 'Special Services', icon: '🧖‍♀️', items: [['Head Massage', ''], ['Body Polishing', ''], ['Back Cleanup', '']] }
].map(category => ({
    ...category,
    items: category.items.map(([name, description], index) => ({
        id: `${category.id}-${index + 1}`,
        name,
        description,
        price: '',
        image: ''
    }))
}));

export const defaultProfile = {
    brand: 'Pretty Touch',
    tagline: 'Your beauty, our passion.',
    about: 'Enjoy a little self-care with personalised beauty services in the comfort of your home. We bring care, comfort and a touch of elegance to every appointment.',
    owner: 'Your Beautician',
    phone: '',
    whatsapp: '',
    instagram: '',
    location: 'Your area / city',
    hours: 'By appointment',
    photo: '',
    cover: ''
};
