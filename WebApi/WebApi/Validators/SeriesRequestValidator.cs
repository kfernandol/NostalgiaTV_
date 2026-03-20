using ApplicationCore.DTOs.Series;
using FluentValidation;

namespace WebApi.Validators
{
    public class SeriesRequestValidator : AbstractValidator<SeriesRequest>
    {
        public SeriesRequestValidator()
        {
            RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
            RuleFor(x => x.Description).MaximumLength(500);
        }
    }
}
