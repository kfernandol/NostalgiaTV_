using ApplicationCore.DTOs.Channel;
using FluentValidation;

namespace WebApi.Validators
{
    public class ChannelRequestValidator : AbstractValidator<ChannelRequest>
    {
        public ChannelRequestValidator()
        {
            RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        }
    }
}
