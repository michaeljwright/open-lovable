// Test to validate Puck config structure
const React = require('react');

// Minimal working Puck config
const config = {
  components: {
    Hero: {
      label: "Hero Section",
      fields: {
        title: {
          type: "text",
          label: "Title"
        },
        subtitle: {
          type: "text",
          label: "Subtitle"
        }
      },
      render: ({ title, subtitle }) =>
        React.createElement('div', { style: { padding: '40px', textAlign: 'center' } },
          React.createElement('h1', {}, title),
          React.createElement('p', {}, subtitle)
        )
    }
  }
};

// Test data
const data = {
  content: [
    {
      type: "Hero",
      props: {
        id: "hero-1",
        title: "Welcome",
        subtitle: "This is a test"
      }
    }
  ],
  root: {
    props: {
      title: "My Site",
      theme: "light"
    }
  },
  zones: {}
};

console.log('Config structure:');
console.log(JSON.stringify(config, null, 2));
console.log('\nData structure:');
console.log(JSON.stringify(data, null, 2));

// Check if all fields have required properties
for (const [componentName, component] of Object.entries(config.components)) {
  console.log(`\nValidating ${componentName}:`);
  console.log(`  - Has label: ${!!component.label}`);
  console.log(`  - Has fields: ${!!component.fields}`);
  console.log(`  - Has render: ${!!component.render}`);

  for (const [fieldName, field] of Object.entries(component.fields)) {
    console.log(`  - Field ${fieldName}:`);
    console.log(`    - Has type: ${!!field.type}`);
    console.log(`    - Has label: ${!!field.label}`);
  }
}
